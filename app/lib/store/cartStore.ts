import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Product } from "../../product-data";
import {
  addCartItem,
  updateCartQuantity,
  removeCartItem,
  fetchCartItems,
  mergeGuestCart,
  CartRequestError,
} from "../api/cart";
import { clampCartQuantity, MAX_CART_QUANTITY } from "../cart-limits";
import { cartLineKey } from "../variants";

type LoadingMap = Record<string, boolean>;

function cartErrorMessage(err: unknown): string {
  if (err instanceof CartRequestError) {
    if (err.status === 401) return "Please sign in to update your cart.";
    if (err.status === 409) return "Not enough stock for that quantity.";
  }
  return "Could not update your cart. Please try again.";
}

/**
 * Cart lines are identified by product *and* variant: two sizes of the same
 * shoe are two independent lines with independent stock.
 */
function isSameLine(line: Product, productId: string, variantSku?: string) {
  return line.id === productId && (line.variantSku ?? undefined) === variantSku;
}

interface CartState {
  cartProducts: Product[];
  guestCart: Product[];
  isAuthenticated: boolean;
  loading: LoadingMap;
  cartError: string | null;

  setAuthenticated: (value: boolean) => Promise<void>;
  setCart: (products: Product[]) => void;
  clearGuestCart: () => void;
  fetchCart: () => Promise<void>;
  addToCart: (product: Product) => Promise<void>;
  updateQuantity: (
    productId: string,
    quantity: number,
    variantSku?: string
  ) => Promise<void>;
  removeFromCart: (productId: string, variantSku?: string) => Promise<void>;
  clearCartError: () => void;

  isLoading: (productId: string, variantSku?: string) => boolean;
  setLoading: (key: string, value: boolean) => void;
  clearLoading: (key: string) => void;

  getSubtotal: () => number;
  getTotalItems: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      cartProducts: [],
      guestCart: [],
      isAuthenticated: false,
      loading: {},
      cartError: null,

      clearCartError: () => set({ cartError: null }),

      setAuthenticated: async (value) => {
        set({ isAuthenticated: value });

        if (!value) {
          set({ cartProducts: get().guestCart });
          return;
        }
        const guestItems = get().guestCart;
        if (guestItems.length > 0) {
          set({ guestCart: [] });
          try {
            const merged = await mergeGuestCart(
              guestItems.map((p) => ({
                productId: p.id,
                quantity: p.quantity || 1,
                ...(p.variantSku ? { variantSku: p.variantSku } : {}),
              }))
            );
            set({ cartProducts: merged });
            return;
          } catch (err) {
            console.error("Failed to merge guest cart:", err);
          }
        }

        await get().fetchCart();
      },

      setCart: (products) => set({ cartProducts: products }),

      clearGuestCart: () => set({ guestCart: [], cartProducts: [] }),

      fetchCart: async () => {
        if (!get().isAuthenticated) {
          set({ cartProducts: get().guestCart });
          return;
        }
        try {
          const cartProducts = await fetchCartItems();
          set({ cartProducts, cartError: null });
        } catch (err) {
          console.error("Failed to fetch cart:", err);
          set({ cartError: cartErrorMessage(err) });
        }
      },

      addToCart: async (product) => {
        const variantSku = product.variantSku;
        const key = cartLineKey(product.id, variantSku);

        if (!get().isAuthenticated) {
          const stock = typeof product.stock === "number" ? product.stock : 0;
          if (stock < 1) {
            set({ cartError: "This product is out of stock." });
            return;
          }
          const current = get().guestCart;
          const index = current.findIndex((p) =>
            isSameLine(p, product.id, variantSku)
          );
          if (index >= 0 && (current[index].quantity || 1) >= stock) {
            set({ cartError: `Only ${stock} in stock.` });
            return;
          }
          const next =
            index >= 0
              ? current.map((p, i) =>
                  i === index
                    ? {
                        ...p,
                        stock,
                        quantity: Math.min(
                          (p.quantity || 1) + 1,
                          MAX_CART_QUANTITY,
                          stock
                        ),
                      }
                    : p
                )
              : [...current, { ...product, stock, quantity: 1 }];
          set({ guestCart: next, cartProducts: next, cartError: null });
          return;
        }

        const { setLoading, clearLoading } = get();
        setLoading(key, true);
        try {
          const updated = await addCartItem(product.id, variantSku);
          set({ cartProducts: updated, cartError: null });
        } catch (err) {
          console.error("Failed to add item:", err);
          set({ cartError: cartErrorMessage(err) });
        } finally {
          clearLoading(key);
        }
      },

      updateQuantity: async (productId, quantity, variantSku) => {
        const key = cartLineKey(productId, variantSku);

        if (!get().isAuthenticated) {
          const item = get().guestCart.find((p) =>
            isSameLine(p, productId, variantSku)
          );
          const stock = typeof item?.stock === "number" ? item.stock : undefined;
          const clamped = quantity <= 0 ? 0 : clampCartQuantity(quantity, stock);
          const overStock =
            quantity > 0 && stock !== undefined && quantity > stock;

          const next = get()
            .guestCart.map((p) =>
              isSameLine(p, productId, variantSku)
                ? { ...p, quantity: clamped }
                : p
            )
            .filter((p) => (p.quantity || 0) > 0);
          set({
            guestCart: next,
            cartProducts: next,
            cartError: overStock ? `Only ${stock} in stock.` : null,
          });
          return;
        }

        const { setLoading, clearLoading } = get();
        setLoading(key, true);
        try {
          const updated = await updateCartQuantity(productId, quantity, variantSku);
          set({ cartProducts: updated, cartError: null });
        } catch (error) {
          console.error("Failed to update quantity:", error);
          set({ cartError: cartErrorMessage(error) });
        } finally {
          clearLoading(key);
        }
      },

      removeFromCart: async (productId, variantSku) => {
        const key = cartLineKey(productId, variantSku);

        if (!get().isAuthenticated) {
          const next = get().guestCart.filter(
            (p) => !isSameLine(p, productId, variantSku)
          );
          set({ guestCart: next, cartProducts: next });
          return;
        }

        const { setLoading, clearLoading } = get();
        setLoading(key, true);
        try {
          const updated = await removeCartItem(productId, variantSku);
          set({ cartProducts: updated, cartError: null });
        } catch (error) {
          console.error("Failed to remove item:", error);
          set({ cartError: cartErrorMessage(error) });
        } finally {
          clearLoading(key);
        }
      },

      setLoading: (key, value) =>
        set((state) => ({
          loading: { ...state.loading, [key]: value },
        })),

      clearLoading: (key) =>
        set((state) => {
          const { [key]: removed, ...rest } = state.loading;
          void removed;
          return { loading: rest };
        }),

      isLoading: (productId, variantSku) =>
        !!get().loading[cartLineKey(productId, variantSku)],

      getSubtotal: () =>
        get().cartProducts.reduce(
          (sum, p) => sum + p.price * (p.quantity || 1),
          0
        ),

      getTotalItems: () =>
        get().cartProducts.reduce((sum, p) => sum + (p.quantity || 1), 0),
    }),
    {
      name: "styleshop-guest-cart",
      partialize: (state) => ({ guestCart: state.guestCart }),
      onRehydrateStorage: () => (state) => {
        if (state && !state.isAuthenticated) {
          state.cartProducts = state.guestCart;
        }
      },
    }
  )
);
