import type { Metadata } from "next";
import { PAGE_SEO } from "@/lib/seo-copy";
import { pageMetadata } from "@/lib/seo";
import { getPageContent, DEFAULT_ABOUT_CONTENT } from "@/lib/page-content";
import { AboutBlocksRenderer } from "@/components/about/AboutBlocksRenderer";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: PAGE_SEO.about.title,
    description: PAGE_SEO.about.description,
  });
}

export default async function AboutPage() {
  const content = await getPageContent("about", DEFAULT_ABOUT_CONTENT);
  return <AboutBlocksRenderer rows={content.rows} />;
}
