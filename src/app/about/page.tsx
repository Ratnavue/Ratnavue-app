import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { getPageContent, DEFAULT_ABOUT_CONTENT } from "@/lib/page-content";
import { AboutBlocksRenderer } from "@/components/about/AboutBlocksRenderer";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: "Our Story",
    description: "Two thousand years of Ceylon gems: how Ratnavue sources, grades and discloses every stone — honest grading, treatment disclosed, stone-first design.",
  });
}

export default async function AboutPage() {
  const content = await getPageContent("about", DEFAULT_ABOUT_CONTENT);
  return <AboutBlocksRenderer rows={content.rows} />;
}
