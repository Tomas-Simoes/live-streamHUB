import { AfterViewInit, Directive, ElementRef } from '@angular/core';

@Directive({
    selector: '[appAutofocus]',
    standalone: false,
})

export class AutofocusDirective implements AfterViewInit {
    constructor(private elementRef: ElementRef<HTMLInputElement>) { }

    ngAfterViewInit() {
        queueMicrotask(() => {
            this.elementRef.nativeElement.focus();
            this.elementRef.nativeElement.select();
        });
    }
}