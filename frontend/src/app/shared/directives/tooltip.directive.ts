import { Directive, Input, ElementRef, HostListener, Renderer2, OnDestroy } from '@angular/core';

export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';

@Directive({
  selector: '[appTooltip]',
  standalone: true
})
export class TooltipDirective implements OnDestroy {
  @Input('appTooltip') text = '';
  @Input() tooltipPosition: TooltipPosition = 'top';
  @Input() tooltipDelay = 200;
  
  private tooltip: HTMLElement | null = null;
  private showTimeout: any;
  
  constructor(
    private el: ElementRef,
    private renderer: Renderer2
  ) {}
  
  @HostListener('mouseenter')
  onMouseEnter(): void {
    if (!this.text) return;
    this.showTimeout = setTimeout(() => this.show(), this.tooltipDelay);
  }
  
  @HostListener('mouseleave')
  onMouseLeave(): void {
    clearTimeout(this.showTimeout);
    this.hide();
  }
  
  @HostListener('click')
  onClick(): void {
    this.hide();
  }
  
  private show(): void {
    this.tooltip = this.renderer.createElement('div');
    this.renderer.addClass(this.tooltip, 'tooltip');
    this.renderer.addClass(this.tooltip, `tooltip--${this.tooltipPosition}`);
    this.tooltip!.textContent = this.text;
    
    this.renderer.appendChild(document.body, this.tooltip);
    this.position();
    
    requestAnimationFrame(() => {
      this.renderer.addClass(this.tooltip, 'tooltip--visible');
    });
  }
  
  private hide(): void {
    if (this.tooltip) {
      this.renderer.removeClass(this.tooltip, 'tooltip--visible');
      setTimeout(() => {
        if (this.tooltip && this.tooltip.parentNode) {
          this.renderer.removeChild(document.body, this.tooltip);
          this.tooltip = null;
        }
      }, 150);
    }
  }
  
  private position(): void {
    if (!this.tooltip) return;
    
    const hostRect = this.el.nativeElement.getBoundingClientRect();
    const tooltipRect = this.tooltip.getBoundingClientRect();
    const gap = 8;
    
    let top = 0, left = 0;
    
    switch (this.tooltipPosition) {
      case 'top':
        top = hostRect.top - tooltipRect.height - gap;
        left = hostRect.left + (hostRect.width - tooltipRect.width) / 2;
        break;
      case 'bottom':
        top = hostRect.bottom + gap;
        left = hostRect.left + (hostRect.width - tooltipRect.width) / 2;
        break;
      case 'left':
        top = hostRect.top + (hostRect.height - tooltipRect.height) / 2;
        left = hostRect.left - tooltipRect.width - gap;
        break;
      case 'right':
        top = hostRect.top + (hostRect.height - tooltipRect.height) / 2;
        left = hostRect.right + gap;
        break;
    }
    
    left = Math.max(8, Math.min(left, window.innerWidth - tooltipRect.width - 8));
    top = Math.max(8, Math.min(top, window.innerHeight - tooltipRect.height - 8));
    
    this.renderer.setStyle(this.tooltip, 'top', `${top}px`);
    this.renderer.setStyle(this.tooltip, 'left', `${left}px`);
  }
  
  ngOnDestroy(): void {
    clearTimeout(this.showTimeout);
    this.hide();
  }
}
