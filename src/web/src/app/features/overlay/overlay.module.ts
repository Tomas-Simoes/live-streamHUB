import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';

import { OverlayComponent } from './pages/overlay.component';

@NgModule({
  declarations: [OverlayComponent],
  imports: [CommonModule],
  exports: [OverlayComponent],
})
export class OverlayModule {}
