import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';

import { HubPreviewComponent } from './components/hub-preview/hub-preview.component';
import { OBSExportButtonComponent } from './components/obs-export/obs-export-button.component';
import { OBSPasswordDialogComponent } from './components/obs-export/obs-password-dialog.component';
import { HubsComponent } from './pages/hubs.component';

@NgModule({
  declarations: [
    HubsComponent,
    HubPreviewComponent,
    OBSExportButtonComponent,
    OBSPasswordDialogComponent,
  ],
  imports: [RouterModule],
  exports: [HubsComponent],
})
export class HubsModule { }
