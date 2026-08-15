import Link from "next/link";
import { formatMoney } from "@/app/lib/money";
import Image from "next/image";
import { connectToDB } from "@/app/api/db";
import { getImageSrc } from "@/app/lib/images";
import { products as productsCollection } from "@/app/lib/db-collections";
import { isSellableForPublic } from "@/app/lib/public-products";

type HomeProduct = {
  id: string;
  name: string;
  price: number;
  imageUrl: string;
};

const steps = [
  {
    number: "01",
    title: "Hunt",
    description:
      "We hit outlets and factory stores looking for pairs actually worth reselling — not leftover sizes nobody wants.",
  },
  {
    number: "02",
    title: "Unbox",
    description:
      "Every pair comes out of the box. No lids, no mysteries. You see the sneakers we pulled, photographed as they are.",
  },
  {
    number: "03",
    title: "Drop",
    description:
      "Once it's listed, it's a one-off. When a pair is gone, it's gone. The next hunt starts again.",
  },
];

async function getHomeProducts(): Promise<HomeProduct[]> {
  try {
    const { db } = await connectToDB();
    // Fetch a wider window then keep sellable ones — sold-out pairs stay in
    // admin but must not fill the homepage featured strip.
    const docs = await productsCollection(db)
      .find({})
      .sort({ name: 1 })
      .limit(24)
      .toArray();

    return docs
      .filter(isSellableForPublic)
      .slice(0, 8)
      .map((doc) => ({
        id: doc.id,
        name: doc.name,
        price: doc.price,
        imageUrl: doc.imageUrl,
      }));
  } catch {
    return [];
  }
}

function TornDivider({ fill }: { fill: string }) {
  return (
    <svg
      className="block w-full h-8 md:h-12"
      viewBox="0 0 1200 40"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        fill={fill}
        d="M0 18 L28 6 L56 22 L92 2 L128 20 L164 4 L200 24 L240 8 L276 22 L316 0 L352 18 L392 6 L428 24 L468 4 L504 20 L544 2 L580 22 L620 8 L656 24 L696 4 L732 18 L772 0 L808 22 L848 8 L884 24 L924 4 L960 20 L1000 2 L1036 18 L1076 6 L1112 22 L1148 8 L1180 20 L1200 10 V40 H0 Z"
      />
    </svg>
  );
}

export default async function LandingPage() {
  const products = await getHomeProducts();
  const featured = products.slice(0, 4);

  return (
    <div className="min-h-screen bg-paper text-ink">
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_35%,rgba(196,165,116,0.35),transparent_55%),linear-gradient(180deg,#faf6ee_0%,#f3eadb_100%)] pointer-events-none" />

        <div className="relative container mx-auto px-4 py-16 lg:py-24">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div className="space-y-8">
              <p className="inline-flex items-center gap-3 text-cardboard-dark font-display font-semibold uppercase tracking-[0.28em] text-sm">
                <span className="h-px w-8 bg-cardboard-dark" />
                Outlet sneaker hunts
              </p>

              <div className="space-y-5">
                <h1 className="font-display italic font-extrabold tracking-tight leading-[0.9] text-6xl sm:text-7xl lg:text-8xl">
                  no lids.
                  <span className="block text-cardboard-dark">just pairs.</span>
                </h1>
                <p className="text-lg text-ink/65 max-w-xl leading-relaxed">
                  We tear through outlet stock so you don&apos;t have to.
                  One-of-a-kind sneakers, unboxed and ready to wear. What you
                  see is what we pulled.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  href="/products"
                  className="inline-flex items-center justify-center rounded-none bg-ink px-7 py-3.5 text-paper font-display font-bold italic text-lg tracking-wide hover:bg-ink/85 transition-colors"
                >
                  Shop the finds
                </Link>
                <Link
                  href="#the-hunt"
                  className="inline-flex items-center justify-center rounded-none border-2 border-ink/20 px-7 py-3.5 font-display font-bold italic text-lg tracking-wide hover:border-cardboard-dark hover:text-cardboard-dark transition-colors"
                >
                  How it works
                </Link>
              </div>
            </div>

            <div className="relative">
              <div className="absolute -inset-6 bg-[radial-gradient(circle,rgba(154,115,68,0.18),transparent_65%)] pointer-events-none" />
              <Image
                src="/nolidz.jpeg"
                alt="nolidz — sneakers in an open box"
                width={900}
                height={900}
                priority
                className="relative w-full h-auto border-2 border-ink/10"
              />
            </div>
          </div>
        </div>

        <TornDivider fill="#ffffff" />
      </section>

      <section className="bg-white border-b-2 border-ink/10">
        <div className="container mx-auto px-4 py-12 lg:py-16">
          <p className="text-cardboard-dark font-display font-semibold uppercase tracking-[0.28em] text-sm mb-6 text-center">
            Shop by
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-4xl mx-auto">
            {(
              [
                { href: "/products?category=women", label: "Women" },
                { href: "/products?category=men", label: "Men" },
                { href: "/products?category=kids", label: "Kids" },
              ] as const
            ).map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group border-2 border-ink/10 bg-paper px-6 py-10 text-center transition-colors hover:border-cardboard hover:bg-white"
              >
                <span className="font-display italic font-extrabold text-3xl sm:text-4xl text-ink group-hover:text-cardboard-dark transition-colors">
                  {item.label}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section id="the-hunt" className="scroll-mt-20 bg-white text-ink py-20 lg:py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mb-14">
            <p className="text-cardboard-dark font-display font-semibold uppercase tracking-[0.28em] text-sm mb-3">
              The hunt
            </p>
            <h2 className="font-display italic font-extrabold text-4xl sm:text-5xl tracking-tight mb-4">
              Straight from the outlet
            </h2>
            <p className="text-lg text-ink/65 leading-relaxed">
              nolidz is not a warehouse of infinite sizes. It&apos;s a curated
              resale of real outlet finds — opened, checked, and listed one pair
              at a time.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 lg:gap-10">
            {steps.map((step) => (
              <div key={step.number} className="border-t-4 border-cardboard pt-6">
                <p className="font-display italic font-extrabold text-cardboard-dark text-3xl mb-3">
                  {step.number}
                </p>
                <h3 className="font-display italic font-extrabold text-3xl mb-3">
                  {step.title}
                </h3>
                <p className="text-ink/65 leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="bg-white">
        <TornDivider fill="#f3eadb" />
      </div>

      <section id="featured" className="scroll-mt-20 py-20 lg:py-24 bg-paper">
        <div className="container mx-auto px-4">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-12">
            <div>
              <p className="text-cardboard-dark font-display font-semibold uppercase tracking-[0.28em] text-sm mb-3">
                Latest finds
              </p>
              <h2 className="font-display italic font-extrabold text-4xl sm:text-5xl tracking-tight">
                In the box
              </h2>
            </div>
            {featured.length > 0 && (
              <Link
                href="/products"
                className="font-display font-bold italic text-lg text-cardboard-dark hover:text-ink transition-colors"
              >
                View all pairs →
              </Link>
            )}
          </div>

          {featured.length > 0 ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 items-stretch">
              {featured.map((product) => (
                <Link
                  key={product.id}
                  href={`/products/${product.id}`}
                  className="group flex h-full flex-col bg-white text-ink overflow-hidden border-2 border-ink/10 hover:border-cardboard transition-colors"
                >
                  <div className="relative aspect-square shrink-0 bg-paper">
                    <Image
                      src={getImageSrc(product.imageUrl)}
                      alt={product.name}
                      fill
                      unoptimized
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                      sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 25vw"
                    />
                  </div>
                  <div className="flex flex-1 flex-col p-4 border-t-2 border-ink/10">
                    <h3 className="line-clamp-2 h-12 font-semibold leading-snug" title={product.name}>
                      {product.name}
                    </h3>
                    <p className="mt-auto pt-2 font-display italic font-bold text-lg text-cardboard-dark">
                      {formatMoney(product.price)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="border-2 border-ink/10 bg-white px-8 py-16 text-center">
              <p className="font-display italic font-extrabold text-3xl mb-3">
                First drop coming soon
              </p>
              <p className="text-ink/55 max-w-md mx-auto leading-relaxed">
                The next outlet hunt is already happening. Check back for the
                pairs that make it out of the box.
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="border-t-2 border-ink/10 py-20 bg-white">
        <div className="container mx-auto px-4 text-center max-w-2xl">
          <h2 className="font-display italic font-extrabold text-4xl sm:text-5xl mb-4 tracking-tight">
            The next hunt is already happening
          </h2>
          <p className="text-lg text-ink/60 mb-8 leading-relaxed">
            Limited finds. No restocks. If a pair speaks to you, grab it before
            it walks.
          </p>
          <Link
            href="/products"
            className="inline-flex items-center justify-center rounded-none bg-cardboard px-8 py-3.5 text-ink font-display font-bold italic text-lg tracking-wide hover:bg-cardboard-dark hover:text-white transition-colors"
          >
            Shop nolidz
          </Link>
        </div>
      </section>

      <footer className="border-t-2 border-ink/10 py-10 bg-paper">
        <div className="container mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Image
              src="/nolidz.jpeg"
              alt=""
              width={36}
              height={36}
              className="h-9 w-9 rounded-md object-cover border border-ink/10"
            />
            <span className="font-display italic font-extrabold text-xl">nolidz</span>
          </div>
          <p className="text-sm text-ink/45">
            Outlet finds. Open boxes. Real pairs.
          </p>
        </div>
      </footer>
    </div>
  );
}
