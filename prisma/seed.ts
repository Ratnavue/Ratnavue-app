import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import {
  STANDARD_CUTS,
  STANDARD_MINERALS,
  CLARITY_GRADES,
  TREATMENTS,
  ORIGINS,
  CERTIFICATION_LABS,
} from "../src/lib/gem-constants";

const prisma = new PrismaClient();

function slugify(input: string): string {
  return input.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");
}

async function main() {
  console.log("Seeding master data...");

  for (const [i, cut] of STANDARD_CUTS.entries()) {
    await prisma.cut.upsert({
      where: { slug: cut.slug },
      update: { name: cut.name, category: cut.category, sortOrder: i },
      create: { name: cut.name, slug: cut.slug, category: cut.category, sortOrder: i },
    });
  }

  for (const [i, mineral] of STANDARD_MINERALS.entries()) {
    await prisma.mineral.upsert({
      where: { slug: mineral.slug },
      update: { name: mineral.name, description: mineral.description, hueMin: mineral.hueMin, hueMax: mineral.hueMax, sortOrder: i },
      create: {
        name: mineral.name,
        slug: mineral.slug,
        description: mineral.description,
        hueMin: mineral.hueMin,
        hueMax: mineral.hueMax,
        sortOrder: i,
      },
    });
  }

  for (const grade of CLARITY_GRADES) {
    await prisma.clarityGrade.upsert({
      where: { slug: grade.slug },
      update: { name: grade.name, description: grade.description, sortOrder: grade.sortOrder },
      create: grade,
    });
  }

  for (const t of TREATMENTS) {
    await prisma.treatment.upsert({ where: { slug: t.slug }, update: { name: t.name }, create: t });
  }

  for (const o of ORIGINS) {
    await prisma.origin.upsert({ where: { slug: o.slug }, update: { name: o.name, isCeylon: o.isCeylon }, create: o });
  }

  for (const [i, lab] of CERTIFICATION_LABS.entries()) {
    await prisma.certificationLab.upsert({
      where: { slug: lab.slug },
      update: { name: lab.name, verifyUrlTemplate: lab.verifyUrlTemplate, sortOrder: i },
      create: { name: lab.name, slug: lab.slug, verifyUrlTemplate: lab.verifyUrlTemplate, sortOrder: i },
    });
  }

  console.log("Seeding accounts...");

  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@ratnavue.com";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe123!";
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      name: "Ratnavue Admin",
      passwordHash: await bcrypt.hash(adminPassword, 12),
      role: "ADMIN",
    },
  });

  const customerEmail = process.env.SEED_CUSTOMER_EMAIL ?? "customer@example.com";
  const customerPassword = process.env.SEED_CUSTOMER_PASSWORD ?? "ChangeMe123!";
  await prisma.user.upsert({
    where: { email: customerEmail },
    update: {},
    create: {
      email: customerEmail,
      name: "Demo Customer",
      passwordHash: await bcrypt.hash(customerPassword, 12),
      role: "CUSTOMER",
    },
  });

  console.log("Seeding demo catalog...");

  const mineralBySlug = Object.fromEntries((await prisma.mineral.findMany()).map((m) => [m.slug, m]));
  const cutBySlug = Object.fromEntries((await prisma.cut.findMany()).map((c) => [c.slug, c]));
  const clarityBySlug = Object.fromEntries((await prisma.clarityGrade.findMany()).map((c) => [c.slug, c]));
  const treatmentBySlug = Object.fromEntries((await prisma.treatment.findMany()).map((t) => [t.slug, t]));
  const originBySlug = Object.fromEntries((await prisma.origin.findMany()).map((o) => [o.slug, o]));
  const labBySlug = Object.fromEntries((await prisma.certificationLab.findMany()).map((l) => [l.slug, l]));

  const demoGems = [
    {
      name: "Ceylon Royal Blue Sapphire",
      mineral: "blue-sapphire",
      variety: "Blue Sapphire",
      cut: "pear",
      carat: 2.35,
      hue: 232,
      sat: 78,
      light: 34,
      clarity: "eye-clean",
      treatment: "unheated",
      origin: "ceylon",
      colorLabel: "Royal Blue",
      image: "/images/gems/blue-sapphire.jpg",
      // Demo-only placeholder report number, wired up to show off the
      // "Verify Certificate" link on the gem detail page.
      certLab: "gia",
      certReportNumber: "2225845812",
    },
    {
      name: "Padparadscha Sapphire, Cushion",
      mineral: "padparadscha-sapphire",
      variety: "Padparadscha",
      cut: "cushion",
      carat: 1.8,
      hue: 22,
      sat: 70,
      light: 62,
      clarity: "loupe-clean",
      treatment: "heated",
      origin: "ceylon",
      colorLabel: "Sunset Pink-Orange",
      image: "/images/gems/padparadscha-sapphire.jpg",
      certLab: undefined as string | undefined,
      certReportNumber: undefined as string | undefined,
    },
    {
      name: "Pigeon's Blood Ruby",
      mineral: "ruby",
      variety: "Ruby",
      cut: "round-brilliant",
      carat: 1.12,
      hue: 355,
      sat: 82,
      light: 38,
      clarity: "slightly-included",
      treatment: "unheated",
      origin: "other-origin",
      colorLabel: "Pigeon's Blood Red",
      image: "/images/gems/ruby.jpg",
      certLab: undefined as string | undefined,
      certReportNumber: undefined as string | undefined,
    },
    {
      name: "Ceylon Cat's Eye Chrysoberyl",
      mineral: "cats-eye-chrysoberyl",
      variety: "Cat's Eye Chrysoberyl",
      cut: "round-cabochon",
      carat: 3.4,
      hue: 65,
      sat: 55,
      light: 55,
      clarity: "included",
      treatment: "unheated",
      origin: "ceylon",
      colorLabel: "Honey Gold",
      image: "/images/gems/cats-eye-chrysoberyl.jpg",
      certLab: undefined as string | undefined,
      certReportNumber: undefined as string | undefined,
    },
    {
      name: "Colour-Change Alexandrite",
      mineral: "alexandrite",
      variety: "Alexandrite",
      cut: "cushion",
      carat: 0.95,
      hue: 130,
      sat: 45,
      light: 40,
      clarity: "eye-clean",
      treatment: "unheated",
      origin: "ceylon",
      colorLabel: "Forest Green (Daylight)",
      image: "/images/gems/alexandrite.jpg",
      certLab: undefined as string | undefined,
      certReportNumber: undefined as string | undefined,
    },
    {
      name: "Vivid Pink Spinel",
      mineral: "spinel",
      variety: "Spinel",
      cut: "pear",
      carat: 1.5,
      hue: 342,
      sat: 68,
      light: 50,
      clarity: "loupe-clean",
      treatment: "unheated",
      origin: "ceylon",
      colorLabel: "Hot Pink",
      image: undefined as string | undefined,
      certLab: undefined as string | undefined,
      certReportNumber: undefined as string | undefined,
    },
  ];

  for (const g of demoGems) {
    const slug = slugify(g.name);
    const fields = {
      name: g.name,
      description: `A fine ${g.variety.toLowerCase()} from our Ceylon-focused collection, cut as a ${g.cut.replace("-", " ")}.`,
      mineralId: mineralBySlug[g.mineral].id,
      variety: g.variety,
      cutId: cutBySlug[g.cut].id,
      caratWeight: g.carat,
      colorHue: g.hue,
      colorSaturation: g.sat,
      colorLightness: g.light,
      colorLabel: g.colorLabel,
      clarityGradeId: clarityBySlug[g.clarity].id,
      treatmentId: treatmentBySlug[g.treatment].id,
      originId: originBySlug[g.origin].id,
      certLabId: g.certLab ? labBySlug[g.certLab]?.id : undefined,
      certReportNumber: g.certReportNumber,
      stockStatus: "AVAILABLE" as const,
      listingStatus: "LIVE" as const,
      isPublished: true,
    };
    const gemstone = await prisma.gemstone.upsert({
      where: { slug },
      update: fields,
      create: { slug, ...fields },
    });

    if (g.image) {
      const existing = await prisma.mediaAsset.findFirst({ where: { gemstoneId: gemstone.id } });
      if (!existing) {
        await prisma.mediaAsset.create({
          data: { gemstoneId: gemstone.id, url: g.image, type: "IMAGE", isPrimary: true, sortOrder: 0, altText: g.name },
        });
      }
    }
  }

  const demoJewelry = [
    {
      name: "Ceylon Sapphire Trilogy Ring",
      pieceType: "RING" as const,
      metalType: "GOLD" as const,
      metalPurity: "18K",
      metalWeightG: 5.2,
      ringSize: "Resizable",
      styleTags: ["Bridal", "Statement"],
      description: "An oval Ceylon blue sapphire flanked by kite-cut diamonds in an 18K gold trilogy setting.",
      image: "/images/jewelry/sapphire-ring.jpg" as string | undefined,
    },
    {
      name: "18K Gold Ruby Pendant",
      pieceType: "PENDANT" as const,
      metalType: "GOLD" as const,
      metalPurity: "18K",
      metalWeightG: 3.1,
      styleTags: ["Everyday"],
      description: "A minimalist 18K gold bezel pendant, designed to let a ruby's colour speak for itself.",
      image: undefined as string | undefined,
      ringSize: undefined as string | undefined,
    },
    {
      name: "Moonstone Drop Earrings",
      pieceType: "EARRINGS" as const,
      metalType: "ROSE_GOLD" as const,
      metalPurity: "18K",
      metalWeightG: 4.4,
      styleTags: ["Everyday", "Bridal"],
      description: "Rose gold drop earrings featuring blue-sheen Ceylon moonstones.",
      image: undefined as string | undefined,
      ringSize: undefined as string | undefined,
    },
  ];

  for (const j of demoJewelry) {
    const slug = slugify(j.name);
    const fields = {
      name: j.name,
      description: j.description,
      pieceType: j.pieceType,
      metalType: j.metalType,
      metalPurity: j.metalPurity,
      metalWeightG: j.metalWeightG,
      ringSize: j.ringSize,
      styleTags: j.styleTags,
      stockStatus: "AVAILABLE" as const,
      listingStatus: "LIVE" as const,
      isPublished: true,
    };
    const piece = await prisma.jewelryPiece.upsert({
      where: { slug },
      update: fields,
      create: { slug, ...fields },
    });

    if (j.image) {
      const existing = await prisma.mediaAsset.findFirst({ where: { jewelryId: piece.id } });
      if (!existing) {
        await prisma.mediaAsset.create({
          data: { jewelryId: piece.id, url: j.image, type: "IMAGE", isPrimary: true, sortOrder: 0, altText: j.name },
        });
      }
    }
  }

  console.log("Seed complete.");
  console.log(`Admin login: ${adminEmail} / ${adminPassword}`);
  console.log(`Customer login: ${customerEmail} / ${customerPassword}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
