import { Component, Input } from '@angular/core';

import { GroupLayer } from '../../../../shared/types/layer.types';

@Component({
  selector: 'app-group-loader',
  standalone: false,
  template: `<span class="group-layer">{{ layer.name }}</span>`,
  styles: [
    `
      :host {
        display: grid;
        width: 100%;
        height: 100%;
        place-items: center;
        overflow: hidden;
      }
    `,
  ],
})
export class GroupLoaderComponent {
  @Input({ required: true }) layer!: GroupLayer;
}
