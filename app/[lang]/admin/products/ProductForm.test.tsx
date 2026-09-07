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
const SIDE = "https://res.cloudinary.com/demo/image/upload/side.png";
const SOLE = "https://res.cloudinary.com/demo/image/upload/sole.png";

const fetchMock = vi.fn();

type Payload = {
  name: string;
  price: number;
  imageUrl: string;
  stock?: number;
  variants?: {
    sku?: string;
    size: string;
    color: string;
    stock: number;
    price?: number;
  }[];
  colorImages?: { color: string; imageUrls: string[] }[];
  images?: string[];
};

function lastPayload(): Payload {
  const [, init] = fetchMock.mock.calls.at(-1)!;
  return JSON.parse((init as RequestInit).body as string);
}

async function fillBasics(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Name"), "Runner Low");
  await user.type(screen.getByLabelText("Description"), "A shoe");
}

/** The size chips in the run builder. */
function sizeChip(size: string) {
  return within(screen.getByText(/Add a size run/).closest("div")!).getByRole(
    "button",
    { name: size }
  );
}

async function stockColour(
  user: ReturnType<typeof userEvent.setup>,
  colour: string,
  sizes: string[],
  price: string,
  photo: string
) {
  const colourInput = screen.getByLabelText("Colour");
  await user.clear(colourInput);
  await user.type(colourInput, colour);
  for (const size of sizes) {
    await user.click(sizeChip(size));
  }
  await user.clear(screen.getByLabelText(`Price for ${colour}`));
  await user.type(screen.getByLabelText(`Price for ${colour}`), price);
  await user.click(
    screen.getByRole("button", { name: `Add photo for ${colour}` })
  );
  await user.type(screen.getByLabelText(`${colour} photo 1 URL`), photo);
}

beforeEach(() => {
  vi.clearAllMocks();
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({ id: "runner-low" }),
  });
  vi.stubGlobal("fetch", fetchMock);
});

describe("creating a product", () => {
  it("requires sizes and colours before saving", async () => {
    const user = userEvent.setup();
    renderWithLocale(<ProductForm mode="create" />);

    await fillBasics(user);
    await user.click(screen.getByRole("button", { name: "Create product" }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText("Add at least one size and colour.")).toBeVisible();
  });

  it("posts derived image/price from the first colour", async () => {
    const user = userEvent.setup();
    renderWithLocale(<ProductForm mode="create" />);

    await fillBasics(user);
    await stockColour(user, "Black", ["42", "43"], "89.99", IMAGE);
    await user.click(screen.getByRole("button", { name: "Create product" }));

    const payload = lastPayload();
    expect(payload).toMatchObject({
      name: "Runner Low",
      imageUrl: IMAGE,
      price: 89.99,
    });
    expect(payload.variants).toEqual([
      { size: "42", color: "Black", stock: 3, price: 89.99 },
      { size: "43", color: "Black", stock: 3, price: 89.99 },
    ]);
    expect(payload.colorImages).toEqual([
      { color: "Black", imageUrls: [IMAGE] },
    ]);
    expect(pushMock).toHaveBeenCalledWith("/en/admin/products");
  });

  it("requires a photo and price per colour", async () => {
    const user = userEvent.setup();
    renderWithLocale(<ProductForm mode="create" />);

    await fillBasics(user);
    await user.type(screen.getByLabelText("Colour"), "Black");
    await user.click(sizeChip("42"));
    await user.click(screen.getByRole("button", { name: "Create product" }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText("Enter a price for Black.")).toBeVisible();
  });

  it("keeps the same size in two colourways as two rows", async () => {
    const user = userEvent.setup();
    renderWithLocale(<ProductForm mode="create" />);

    await fillBasics(user);
    await stockColour(user, "Black", ["42"], "89.99", IMAGE);
    await stockColour(user, "White", ["42"], "99.99", SIDE);
    await user.click(screen.getByRole("button", { name: "Create product" }));

    expect(lastPayload().variants).toEqual([
      { size: "42", color: "Black", stock: 3, price: 89.99 },
      { size: "42", color: "White", stock: 3, price: 99.99 },
    ]);
    expect(lastPayload().colorImages).toEqual([
      { color: "Black", imageUrls: [IMAGE] },
      { color: "White", imageUrls: [SIDE] },
    ]);
  });
});

describe("the size run builder", () => {
  it("requires a colour before sizes can be tapped", async () => {
    const user = userEvent.setup();
    renderWithLocale(<ProductForm mode="create" />);

    expect(sizeChip("42")).toBeDisabled();

    await user.type(screen.getByLabelText("Colour"), "Black");
    expect(sizeChip("42")).toBeEnabled();
  });

  it("builds one row per tapped size and totals the stock", async () => {
    const user = userEvent.setup();
    renderWithLocale(<ProductForm mode="create" />);

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

    await user.type(screen.getByLabelText("Colour"), "Black");
    await user.click(sizeChip("42"));
    await user.click(sizeChip("42"));

    expect(screen.queryByText(/across .* variants/)).toBeNull();
  });
});

describe("shared photos", () => {
  async function addSharedPhoto(
    user: ReturnType<typeof userEvent.setup>,
    slot: number,
    url: string
  ) {
    await user.click(screen.getByRole("button", { name: "Add photo" }));
    await user.type(screen.getByLabelText(`Extra photo ${slot} URL`), url);
  }

  it("sends shared photos after colour shoots", async () => {
    const user = userEvent.setup();
    renderWithLocale(<ProductForm mode="create" />);

    await fillBasics(user);
    await stockColour(user, "Black", ["42"], "89.99", IMAGE);
    await addSharedPhoto(user, 1, SOLE);
    await addSharedPhoto(user, 2, SIDE);
    await user.click(screen.getByRole("button", { name: "Create product" }));

    expect(lastPayload().images).toEqual([SOLE, SIDE]);
  });

  it("stops offering new shared slots at the cap", async () => {
    const user = userEvent.setup();
    renderWithLocale(<ProductForm mode="create" />);

    await fillBasics(user);
    await stockColour(user, "Black", ["42"], "89.99", IMAGE);
    for (let i = 1; i <= MAX_PRODUCT_IMAGES; i++) {
      await addSharedPhoto(user, i, `${SOLE}?${i}`);
    }

    expect(screen.getByRole("button", { name: "Add photo" })).toBeDisabled();
  });
});

describe("colour photo upload", () => {
  const file = () => new File(["binary"], "shoe.png", { type: "image/png" });

  it("signs, uploads, and fills the colour photo slot", async () => {
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
    await user.type(screen.getByLabelText("Colour"), "Black");
    await user.click(sizeChip("42"));
    await user.click(screen.getByRole("button", { name: "Add photo for Black" }));

    const upload = screen.getByLabelText(/Upload/i, { selector: "input" });
    await user.upload(upload, file());

    expect(screen.getByLabelText("Black photo 1 URL")).toHaveValue(IMAGE);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/admin/uploads/sign");
  });

  it("reports a signing failure", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Cloudinary is not configured" }),
    });

    renderWithLocale(<ProductForm mode="create" />);
    await user.type(screen.getByLabelText("Colour"), "Black");
    await user.click(sizeChip("42"));
    await user.click(screen.getByRole("button", { name: "Add photo for Black" }));
    await user.upload(
      screen.getByLabelText(/Upload/i, { selector: "input" }),
      file()
    );

    expect(screen.getByText("Cloudinary is not configured")).toBeVisible();
  });
});

describe("editing an existing product", () => {
  const initial = {
    id: "runner",
    name: "Runner",
    description: "A shoe",
    imageUrl: IMAGE,
    price: 89.99,
    stock: 5,
    variants: [
      { sku: "runner-eu42-black", size: "42", color: "Black", stock: 3, price: 89.99 },
      { sku: "runner-eu43-black", size: "43", color: "Black", stock: 2, price: 89.99 },
    ],
    colorImages: [
      {
        color: "Black",
        imageUrls: [IMAGE],
      },
    ],
  };

  it("opens with the existing rows and colour photo", () => {
    renderWithLocale(<ProductForm mode="edit" initial={initial} />);

    expect(screen.getByText("5 across 2 variants")).toBeVisible();
    expect(screen.getByLabelText("EU size for row 1")).toHaveValue("42");
    expect(screen.getByLabelText("Black photo 1 URL")).toHaveValue(IMAGE);
    expect(screen.getByLabelText("Price for Black")).toHaveValue(89.99);
  });

  it("keeps existing SKUs so carts holding them stay valid", async () => {
    const user = userEvent.setup();
    renderWithLocale(<ProductForm mode="edit" initial={initial} />);

    const stock = screen.getByLabelText("Stock for row 1");
    await user.clear(stock);
    await user.type(stock, "9");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(lastPayload().variants).toEqual([
      {
        sku: "runner-eu42-black",
        size: "42",
        color: "Black",
        stock: 9,
        price: 89.99,
      },
      {
        sku: "runner-eu43-black",
        size: "43",
        color: "Black",
        stock: 2,
        price: 89.99,
      },
    ]);
  });

  it("seeds a legacy single-SKU photo onto the first colour stocked", async () => {
    const user = userEvent.setup();
    renderWithLocale(
      <ProductForm
        mode="edit"
        initial={{
          id: "mug",
          name: "Mug",
          description: "A mug",
          imageUrl: IMAGE,
          price: 14.99,
          stock: 4,
        }}
      />
    );

    expect(
      screen.getByText(/predates sizes & colours/i)
    ).toBeVisible();

    await user.type(screen.getByLabelText("Colour"), "Black");
    await user.click(sizeChip("42"));

    expect(screen.getByLabelText("Black photo 1 URL")).toHaveValue(IMAGE);
    expect(screen.getByLabelText("Price for Black")).toHaveValue(14.99);
  });

  it("surfaces a server error instead of navigating away", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Nope" }),
    });
    renderWithLocale(<ProductForm mode="edit" initial={initial} />);

    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(screen.getByText("Nope")).toBeVisible();
    expect(pushMock).not.toHaveBeenCalled();
  });
});
