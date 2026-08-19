// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import { renderWithLocale } from "@/app/test/render";
import userEvent from "@testing-library/user-event";

const { pushMock, refreshMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  refreshMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}));

import ProductForm from "./ProductForm";
import { MAX_PRODUCT_IMAGES } from "@/app/lib/images";

const IMAGE = "https://res.cloudinary.com/demo/image/upload/runner.png";

const fetchMock = vi.fn();

type Payload = {
  name: string;
  price: number;
  stock?: number;
  variants?: { sku?: string; size: string; color: string; stock: number; price?: number }[];
  colorImages?: { color: string; imageUrl: string }[];
  images?: string[];
};

function lastPayload(): Payload {
  const [, init] = fetchMock.mock.calls.at(-1)!;
  return JSON.parse((init as RequestInit).body as string);
}

async function fillBaseFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Name"), "Runner Low");
  await user.type(screen.getByLabelText("Description"), "A shoe");
  await user.type(screen.getByLabelText("Product image"), IMAGE);
  await user.type(screen.getByLabelText("Price (EUR)"), "89.99");
}

/** The size chips in the run builder, which share labels with nothing else. */
function sizeChip(size: string) {
  return within(screen.getByText(/Add a size run/).closest("div")!).getByRole(
    "button",
    { name: size }
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ id: "runner-low" }) });
  vi.stubGlobal("fetch", fetchMock);
});

describe("gallery photos", () => {
  const SOLE = "https://res.cloudinary.com/demo/image/upload/sole.png";
  const SIDE = "https://res.cloudinary.com/demo/image/upload/side.png";

  async function addPhoto(
    user: ReturnType<typeof userEvent.setup>,
    slot: number,
    url: string
  ) {
    await user.click(screen.getByRole("button", { name: "Add photo" }));
    await user.type(screen.getByLabelText(`Extra photo ${slot} URL`), url);
  }

  it("sends the extra photos in the order shown", async () => {
    const user = userEvent.setup();
    renderWithLocale(<ProductForm mode="create" />);

    await fillBaseFields(user);
    await addPhoto(user, 1, SOLE);
    await addPhoto(user, 2, SIDE);
    await user.click(screen.getByRole("button", { name: "Create product" }));

    expect(lastPayload().images).toEqual([SOLE, SIDE]);
  });

  it("reorders a photo with the move buttons", async () => {
    const user = userEvent.setup();
    renderWithLocale(<ProductForm mode="create" />);

    await fillBaseFields(user);
    await addPhoto(user, 1, SOLE);
    await addPhoto(user, 2, SIDE);
    await user.click(screen.getByRole("button", { name: "Move photo 2 up" }));
    await user.click(screen.getByRole("button", { name: "Create product" }));

    expect(lastPayload().images).toEqual([SIDE, SOLE]);
  });

  it("drops a slot opened but never filled", async () => {
    const user = userEvent.setup();
    renderWithLocale(<ProductForm mode="create" />);

    await fillBaseFields(user);
    await addPhoto(user, 1, SOLE);
    await user.click(screen.getByRole("button", { name: "Add photo" }));
    await user.click(screen.getByRole("button", { name: "Create product" }));

    expect(lastPayload().images).toEqual([SOLE]);
    expect(pushMock).toHaveBeenCalledWith("/en/admin/products");
  });

  it("blocks a photo URL that is not a URL", async () => {
    const user = userEvent.setup();
    renderWithLocale(<ProductForm mode="create" />);

    await fillBaseFields(user);
    await addPhoto(user, 1, "not-a-url");
    await user.click(screen.getByRole("button", { name: "Create product" }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText(/Each extra photo needs a Cloudinary URL/)).toBeVisible();
  });

  it("stops offering new slots at the extra-photo cap", async () => {
    const user = userEvent.setup();
    renderWithLocale(<ProductForm mode="create" />);

    await fillBaseFields(user);
    for (let i = 1; i <= MAX_PRODUCT_IMAGES; i++) {
      await addPhoto(user, i, `${SOLE}?${i}`);
    }

    expect(screen.getByRole("button", { name: "Add photo" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Create product" }));
    expect(lastPayload().images).toHaveLength(MAX_PRODUCT_IMAGES);
  });

  it("opens an edit with the saved gallery and clears it on removal", async () => {
    const user = userEvent.setup();
    renderWithLocale(
      <ProductForm
        mode="edit"
        initial={{
          id: "runner",
          name: "Runner",
          description: "A shoe",
          imageUrl: IMAGE,
          price: 89.99,
          stock: 4,
          images: [SOLE],
        }}
      />
    );

    expect(screen.getByLabelText("Extra photo 1 URL")).toHaveValue(SOLE);

    await user.click(screen.getByRole("button", { name: "Remove" }));
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    // An empty array is what tells the server to drop the gallery.
    expect(lastPayload().images).toEqual([]);
  });
});

describe("single-SKU products", () => {
  it("posts a plain stock count with no variants", async () => {
    const user = userEvent.setup();
    renderWithLocale(<ProductForm mode="create" />);

    await fillBaseFields(user);
    await user.clear(screen.getByLabelText("Stock"));
    await user.type(screen.getByLabelText("Stock"), "12");
    await user.click(screen.getByRole("button", { name: "Create product" }));

    const payload = lastPayload();
    expect(payload).toMatchObject({ name: "Runner Low", price: 89.99, stock: 12 });
    expect(payload.variants).toBeUndefined();
    expect(pushMock).toHaveBeenCalledWith("/en/admin/products");
  });

  it("blocks a negative stock count before sending anything", async () => {
    const user = userEvent.setup();
    renderWithLocale(<ProductForm mode="create" />);

    await fillBaseFields(user);
    await user.clear(screen.getByLabelText("Stock"));
    await user.type(screen.getByLabelText("Stock"), "-3");
    await user.click(screen.getByRole("button", { name: "Create product" }));

    expect(screen.getByText("Stock must be a whole number ≥ 0.")).toBeVisible();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("blocks an image URL that is not a URL", async () => {
    const user = userEvent.setup();
    renderWithLocale(<ProductForm mode="create" />);

    await user.type(screen.getByLabelText("Name"), "Runner Low");
    await user.type(screen.getByLabelText("Description"), "A shoe");
    await user.type(screen.getByLabelText("Product image"), "not-a-url");
    await user.type(screen.getByLabelText("Price (EUR)"), "10");
    await user.click(screen.getByRole("button", { name: "Create product" }));

    expect(screen.getByText(/Upload an image or paste a Cloudinary URL/)).toBeVisible();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("image upload", () => {
  const file = () => new File(["binary"], "shoe.png", { type: "image/png" });

  function uploadInput() {
    return screen.getByLabelText(/Upload image/i, { selector: "input" });
  }

  it("signs, uploads, and fills in the returned URL", async () => {
    const user = userEvent.setup();
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          cloudName: "demo",
          apiKey: "key",
          timestamp: "1",
          folder: "f",
          signature: "sig",
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ secure_url: IMAGE }),
      });

    renderWithLocale(<ProductForm mode="create" />);
    await user.upload(uploadInput(), file());

    expect(screen.getByLabelText("Product image")).toHaveValue(IMAGE);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/admin/uploads/sign");
    expect(fetchMock.mock.calls[1][0]).toContain("api.cloudinary.com");
  });

  it("reports a signing failure without touching the URL field", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Cloudinary is not configured" }),
    });

    renderWithLocale(<ProductForm mode="create" />);
    await user.upload(uploadInput(), file());

    expect(screen.getByText("Cloudinary is not configured")).toBeVisible();
    expect(screen.getByLabelText("Product image")).toHaveValue("");
  });

  it("reports a failed upload", async () => {
    const user = userEvent.setup();
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ cloudName: "demo", apiKey: "key" }),
      })
      .mockResolvedValueOnce({ ok: false, json: async () => ({}) });

    renderWithLocale(<ProductForm mode="create" />);
    await user.upload(uploadInput(), file());

    expect(screen.getByText("Image upload failed. Try another file.")).toBeVisible();
  });
});

describe("the size run builder", () => {
  async function enableVariants(user: ReturnType<typeof userEvent.setup>) {
    await user.click(
      screen.getByRole("checkbox", { name: /Sell this product by EU size/i })
    );
  }

  it("requires a colour before sizes can be tapped", async () => {
    const user = userEvent.setup();
    renderWithLocale(<ProductForm mode="create" />);
    await enableVariants(user);

    expect(sizeChip("42")).toBeDisabled();

    await user.type(screen.getByLabelText("Colour"), "Black");
    expect(sizeChip("42")).toBeEnabled();
  });

  it("builds one row per tapped size and totals the stock", async () => {
    const user = userEvent.setup();
    renderWithLocale(<ProductForm mode="create" />);
    await enableVariants(user);

    await user.type(screen.getByLabelText("Colour"), "Black");
    await user.clear(screen.getByLabelText("Stock per size"));
    await user.type(screen.getByLabelText("Stock per size"), "4");

    await user.click(sizeChip("42"));
    await user.click(sizeChip("43"));

    expect(screen.getByText("8 across 2 variants")).toBeVisible();
  });

  it("toggles a size back off when tapped again", async () => {
    const user = userEvent.setup();
    renderWithLocale(<ProductForm mode="create" />);
    await enableVariants(user);

    await user.type(screen.getByLabelText("Colour"), "Black");
    await user.click(sizeChip("42"));
    await user.click(sizeChip("42"));

    expect(screen.getByText("0 across 0 variants")).toBeVisible();
  });

  it("keeps the same size in two colourways as two rows", async () => {
    const user = userEvent.setup();
    renderWithLocale(<ProductForm mode="create" />);
    await enableVariants(user);

    const colour = screen.getByLabelText("Colour");
    await user.type(colour, "Black");
    await user.click(sizeChip("42"));

    await user.clear(colour);
    await user.type(colour, "White");
    await user.click(sizeChip("42"));

    expect(screen.getByText(/across 2 variants/)).toBeVisible();
  });

  it("posts the rows and omits the derived stock count", async () => {
    const user = userEvent.setup();
    renderWithLocale(<ProductForm mode="create" />);

    await fillBaseFields(user);
    await enableVariants(user);
    await user.type(screen.getByLabelText("Colour"), "Black");
    await user.clear(screen.getByLabelText("Stock per size"));
    await user.type(screen.getByLabelText("Stock per size"), "2");
    await user.click(sizeChip("42"));

    await user.click(screen.getByRole("button", { name: "Create product" }));

    const payload = lastPayload();
    expect(payload.variants).toEqual([
      { size: "42", color: "Black", stock: 2, price: 89.99 },
    ]);
    // The server derives the total; sending one too would let them disagree.
    expect(payload.stock).toBeUndefined();
  });

  it("sends a photo per colourway and drops colours with none", async () => {
    const user = userEvent.setup();
    renderWithLocale(<ProductForm mode="create" />);

    await fillBaseFields(user);
    await enableVariants(user);
    await user.type(screen.getByLabelText("Colour"), "Black");
    await user.click(sizeChip("42"));

    await user.type(
      screen.getByLabelText("Photo URL for Black"),
      "https://res.cloudinary.com/demo/image/upload/black.png"
    );
    await user.click(screen.getByRole("button", { name: "Create product" }));

    expect(lastPayload().colorImages).toEqual([
      {
        color: "Black",
        imageUrl: "https://res.cloudinary.com/demo/image/upload/black.png",
      },
    ]);
  });

  it("offers one photo row per colourway, not per size", async () => {
    const user = userEvent.setup();
    renderWithLocale(<ProductForm mode="create" />);

    await enableVariants(user);
    const colour = screen.getByLabelText("Colour");
    await user.type(colour, "Black");
    await user.click(sizeChip("42"));
    await user.click(sizeChip("43"));
    await user.clear(colour);
    await user.type(colour, "White");
    await user.click(sizeChip("42"));

    expect(screen.getByLabelText("Photo URL for Black")).toBeVisible();
    expect(screen.getByLabelText("Photo URL for White")).toBeVisible();
    expect(screen.queryByLabelText("Photo URL for ")).toBeNull();
  });

  it("stamps a different price onto each colourway", async () => {
    const user = userEvent.setup();
    renderWithLocale(<ProductForm mode="create" />);

    await fillBaseFields(user);
    await enableVariants(user);
    const colour = screen.getByLabelText("Colour");
    await user.type(colour, "Black");
    await user.click(sizeChip("42"));
    await user.clear(colour);
    await user.type(colour, "White");
    await user.click(sizeChip("42"));

    const whitePrice = screen.getByLabelText("Price for White");
    await user.clear(whitePrice);
    await user.type(whitePrice, "109.99");
    await user.click(screen.getByRole("button", { name: "Create product" }));

    expect(lastPayload().variants).toEqual([
      { size: "42", color: "Black", stock: 3, price: 89.99 },
      { size: "42", color: "White", stock: 3, price: 109.99 },
    ]);
  });

  it("refuses to submit with variants on and no rows", async () => {
    const user = userEvent.setup();
    renderWithLocale(<ProductForm mode="create" />);

    await fillBaseFields(user);
    await enableVariants(user);
    await user.click(screen.getByRole("button", { name: "Create product" }));

    expect(
      screen.getByText(/Add at least one size\/colour, or turn variants off/)
    ).toBeVisible();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("catches a duplicate size and colour typed by hand", async () => {
    const user = userEvent.setup();
    renderWithLocale(<ProductForm mode="create" />);

    await fillBaseFields(user);
    await enableVariants(user);
    await user.type(screen.getByLabelText("Colour"), "Black");
    await user.click(sizeChip("42"));
    await user.click(sizeChip("43"));

    // Retype the second row's size to collide with the first.
    const secondSize = screen.getByLabelText("EU size for row 2");
    await user.clear(secondSize);
    await user.type(secondSize, "42");

    await user.click(screen.getByRole("button", { name: "Create product" }));

    expect(screen.getByText(/EU 42 \/ Black is listed twice/)).toBeVisible();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("catches a row left without a size", async () => {
    const user = userEvent.setup();
    renderWithLocale(<ProductForm mode="create" />);

    await fillBaseFields(user);
    await enableVariants(user);
    await user.type(screen.getByLabelText("Colour"), "Black");
    await user.click(screen.getByRole("button", { name: "Add empty row" }));
    await user.click(screen.getByRole("button", { name: "Create product" }));

    expect(screen.getByText("Every variant needs an EU size.")).toBeVisible();
  });

  it("removes a row", async () => {
    const user = userEvent.setup();
    renderWithLocale(<ProductForm mode="create" />);

    await user.click(
      screen.getByRole("checkbox", { name: /Sell this product by EU size/i })
    );
    await user.type(screen.getByLabelText("Colour"), "Black");
    await user.click(sizeChip("42"));
    await user.click(screen.getByRole("button", { name: "Remove" }));

    expect(screen.getByText("0 across 0 variants")).toBeVisible();
  });
});

describe("editing an existing variant product", () => {
  const initial = {
    id: "runner",
    name: "Runner",
    description: "A shoe",
    imageUrl: IMAGE,
    price: 89.99,
    stock: 5,
    variants: [
      { sku: "runner-eu42-black", size: "42", color: "Black", stock: 3 },
      { sku: "runner-eu43-black", size: "43", color: "Black", stock: 2 },
    ],
    colorImages: [
      {
        color: "Black",
        imageUrl: "https://res.cloudinary.com/demo/image/upload/black.png",
      },
    ],
  };

  it("opens with the existing rows and the derived total", () => {
    renderWithLocale(<ProductForm mode="edit" initial={initial} />);

    expect(
      screen.getByRole("checkbox", { name: /Sell this product by EU size/i })
    ).toBeChecked();
    expect(screen.getByText("5 across 2 variants")).toBeVisible();
    expect(screen.getByLabelText("EU size for row 1")).toHaveValue("42");
  });

  it("keeps existing SKUs so carts holding them stay valid", async () => {
    const user = userEvent.setup();
    renderWithLocale(<ProductForm mode="edit" initial={initial} />);

    const stock = screen.getByLabelText("Stock for row 1");
    await user.clear(stock);
    await user.type(stock, "9");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(lastPayload().variants).toEqual([
      { sku: "runner-eu42-black", size: "42", color: "Black", stock: 9, price: 89.99 },
      { sku: "runner-eu43-black", size: "43", color: "Black", stock: 2, price: 89.99 },
    ]);
  });

  it("opens with the saved colour photo", () => {
    renderWithLocale(<ProductForm mode="edit" initial={initial} />);
    expect(screen.getByLabelText("Photo URL for Black")).toHaveValue(
      "https://res.cloudinary.com/demo/image/upload/black.png"
    );
  });

  it("sends an empty array when variants are switched off", async () => {
    const user = userEvent.setup();
    renderWithLocale(<ProductForm mode="edit" initial={initial} />);

    await user.click(
      screen.getByRole("checkbox", { name: /Sell this product by EU size/i })
    );
    await user.clear(screen.getByLabelText("Stock"));
    await user.type(screen.getByLabelText("Stock"), "6");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    const payload = lastPayload();
    expect(payload.variants).toEqual([]);
    // Colour photos belong to the variants; clearing one clears the other.
    expect(payload.colorImages).toEqual([]);
    expect(payload.stock).toBe(6);
  });

  it("surfaces a server error instead of navigating away", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({ error: "A product with this id already exists" }),
    });

    renderWithLocale(<ProductForm mode="edit" initial={initial} />);
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(
      screen.getByText("A product with this id already exists")
    ).toBeVisible();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("reports a network failure", async () => {
    const user = userEvent.setup();
    fetchMock.mockRejectedValue(new Error("offline"));

    renderWithLocale(<ProductForm mode="edit" initial={initial} />);
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(screen.getByText("Network error — please try again.")).toBeVisible();
  });
});
