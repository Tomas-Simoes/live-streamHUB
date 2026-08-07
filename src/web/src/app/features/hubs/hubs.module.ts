import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';

import { HubsComponent } from './components/hubs.component';

@NgModule({
  declarations: [HubsComponent],
  imports: [RouterModule],
  exports: [HubsComponent],
})
export class HubsModule { }
