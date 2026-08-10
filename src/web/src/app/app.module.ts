import { NgModule } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { AuthModule } from './features/auth/auth.module';
import { EditorModule } from './features/editor/editor.module';
import { HomeModule } from './features/home/home.module';
import { HubsModule } from './features/hubs/hubs.module';

@NgModule({
  declarations: [AppComponent],
  imports: [BrowserModule, HomeModule, AuthModule, EditorModule, HubsModule, AppRoutingModule],
  providers: [provideHttpClient()],
  bootstrap: [AppComponent],
})
export class AppModule {}
