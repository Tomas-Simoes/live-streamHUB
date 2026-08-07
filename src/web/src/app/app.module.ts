import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { EditorModule } from './features/editor/editor.module';
import { HubsModule } from './features/hubs/hubs.module';

@NgModule({
  declarations: [AppComponent],
  imports: [BrowserModule, EditorModule, HubsModule, AppRoutingModule],
  bootstrap: [AppComponent],
})
export class AppModule {}
