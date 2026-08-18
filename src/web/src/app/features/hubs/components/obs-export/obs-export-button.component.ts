import { Component, EventEmitter, Input, Output, signal } from "@angular/core";
import { OBSApi } from "src/app/core/api/obs.api";
import { OBSPasswordStore } from "src/app/core/obs.store";
import { Hub } from "src/app/shared/types/hub.types";

import { OBSPasswordDialogSubmit } from "./obs-password-dialog.component";

@Component({
  selector: "app-obs-export-button",
  standalone: false,
  templateUrl: "./obs-export-button.component.html",
  styleUrls: ["./obs-export-button.styles.css"],
})
export class OBSExportButtonComponent {
  @Input({ required: true }) hub!: Hub;
  @Output() exported = new EventEmitter<Hub>();

  isPasswordDialogOpen = signal(false);
  isExporting = signal(false);
  exportError = signal<string | null>(null);

  constructor(
    private obsApi: OBSApi,
    private obsPasswordStore: OBSPasswordStore,
  ) {}

  async exportToObs() {
    this.exportError.set(null);

    const savedPassword = this.obsPasswordStore.getPassword();

    if (!savedPassword) {
      this.isPasswordDialogOpen.set(true);
      return;
    }

    await this.connectAndExport(savedPassword);
  }

  closePasswordDialog() {
    if (this.isExporting()) {
      return;
    }

    this.isPasswordDialogOpen.set(false);
    this.exportError.set(null);
  }

  async submitPassword({
    password,
    rememberPassword,
  }: OBSPasswordDialogSubmit) {
    if (rememberPassword) {
      this.obsPasswordStore.remember(password);
    } else {
      this.obsPasswordStore.saveForSession(password);
    }

    await this.connectAndExport(password);
  }

  private async connectAndExport(password: string) {
    this.isExporting.set(true);
    this.exportError.set(null);

    try {
      const isConnected = await this.obsApi.createConnection(password);

      if (!isConnected) {
        this.obsPasswordStore.clearSession();
        this.obsPasswordStore.forgetRemembered();
        this.exportError.set(this.getObsConnectionErrorMessage());
        this.isPasswordDialogOpen.set(true);
        return;
      }

      this.isPasswordDialogOpen.set(false);
      await this.obsApi.exportHub(this.hub);

      this.exported.emit(this.hub);
    } catch (error) {
      this.exportError.set(this.getObsExportErrorMessage(error));
    } finally {
      this.isExporting.set(false);
    }
  }

  private getObsConnectionErrorMessage(error?: unknown) {
    if (error instanceof Error && error.message) {
      return error.message;
    }

    return "Could not connect to OBS. Check that OBS is open and WebSocket is enabled.";
  }

  private getObsExportErrorMessage(error: unknown) {
    if (error instanceof Error && error.message) {
      if (error.message.toLowerCase().includes("input kind is not supported")) {
        return "Your current OBS version does not support Browser Sources. Enable the OBS Browser Source then try again.";
      }

      return error.message;
    }

    return "Connected to OBS, but could not export this hub.";
  }
}
