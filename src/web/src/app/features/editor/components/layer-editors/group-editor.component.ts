import { Component, Input } from '@angular/core';

import { GroupLayer } from '../../../../shared/types/layer.types';

@Component({
  selector: 'app-group-editor',
  standalone: false,
  template: `
    <section class="inspector-section" aria-label="Group settings"></section>
  `,
})
export class GroupEditorComponent {
  @Input({ required: true }) layer!: GroupLayer;
}
