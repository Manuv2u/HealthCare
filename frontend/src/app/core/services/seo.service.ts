import { DOCUMENT } from '@angular/common';
import { Inject, Injectable, Renderer2, RendererFactory2 } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { environment } from '../../../environments/environment';

export interface SeoPageMeta {
  title: string;
  description: string;
  path: string;
  image?: string;
  noIndex?: boolean;
}

@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly renderer: Renderer2;
  private readonly siteUrl = environment.siteUrl;
  private readonly siteName = 'Sri Health Plus';

  constructor(
    private readonly titleService: Title,
    private readonly meta: Meta,
    rendererFactory: RendererFactory2,
    @Inject(DOCUMENT) private readonly document: Document,
  ) {
    this.renderer = rendererFactory.createRenderer(null, null);
  }

  setPage(page: SeoPageMeta): void {
    const fullTitle = `${this.siteName} | ${page.title}`;
    const canonicalUrl = this.absoluteUrl(page.path);

    this.titleService.setTitle(fullTitle);
    this.meta.updateTag({ name: 'description', content: page.description });
    this.meta.updateTag({ name: 'robots', content: page.noIndex ? 'noindex, nofollow' : 'index, follow' });

    this.meta.updateTag({ property: 'og:title', content: fullTitle });
    this.meta.updateTag({ property: 'og:description', content: page.description });
    this.meta.updateTag({ property: 'og:url', content: canonicalUrl });
    this.meta.updateTag({ property: 'og:type', content: 'website' });
    this.meta.updateTag({ property: 'og:site_name', content: this.siteName });

    const image = this.resolveImage(page.image);
    this.meta.updateTag({ property: 'og:image', content: image });
    this.meta.updateTag({ name: 'twitter:image', content: image });
    this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    this.meta.updateTag({ name: 'twitter:title', content: fullTitle });
    this.meta.updateTag({ name: 'twitter:description', content: page.description });

    this.setCanonical(canonicalUrl);
  }

  setJsonLd(id: string, data: Record<string, unknown> | Record<string, unknown>[]): void {
    this.clearJsonLd(id);
    const script = this.renderer.createElement('script') as HTMLScriptElement;
    this.renderer.setAttribute(script, 'type', 'application/ld+json');
    this.renderer.setAttribute(script, 'id', this.scriptId(id));
    script.text = JSON.stringify(data);
    this.renderer.appendChild(this.document.head, script);
  }

  clearJsonLd(id: string): void {
    const existing = this.document.getElementById(this.scriptId(id));
    if (existing) {
      this.renderer.removeChild(this.document.head, existing);
    }
  }

  absoluteUrl(path: string): string {
    return `${this.siteUrl}${path.startsWith('/') ? path : `/${path}`}`;
  }

  private resolveImage(image?: string): string {
    const fallback = `${this.siteUrl}/assets/logo-full.png`;
    if (!image) return fallback;
    return image.startsWith('http') ? image : this.absoluteUrl(image.startsWith('/') ? image : `/${image}`);
  }

  private scriptId(id: string): string {
    return `jsonld-${id}`;
  }

  private setCanonical(url: string): void {
    let link = this.document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = this.renderer.createElement('link');
      this.renderer.setAttribute(link, 'rel', 'canonical');
      this.renderer.appendChild(this.document.head, link);
    }
    this.renderer.setAttribute(link, 'href', url);
  }
}
