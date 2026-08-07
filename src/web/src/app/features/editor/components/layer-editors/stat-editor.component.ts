import { Component, Input } from '@angular/core';

import { KillsLayer, TowersLayer } from '../../../../shared/types/layer.types';

@Component({
  selector: 'app-stat-editor',
  standalone: false,
  template: `
    <section class="inspector-section" aria-label="Stat settings"></section>
  `,
})
export class StatEditorComponent {
  @Input({ required: true }) layer!: KillsLayer | TowersLayer;
}
