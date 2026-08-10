import { Component, EventEmitter, Input, Output } from "@angular/core";

export type OBSPasswordDialogSubmit = {
  password: string;
  rememberPassword: boolean;
};

@Component({
  selector: "app-obs-password-dialog",
  standalone: false,
  templateUrl: "./obs-password-dialog.component.html",
  styleUrls: ["./obs-password-dialog.styles.css"],
})
export class OBSPasswordDialogComponent {
  @Input() errorMessage: string | null = null;
  @Input() isSubmitting = false;

  @Output() cancelled = new EventEmitter<void>();
  @Output() submitted = new EventEmitter<OBSPasswordDialogSubmit>();

  submit(password: string, rememberPassword: boolean) {
    const cleanPassword = password.trim();

    if (!cleanPassword || this.isSubmitting) {
      return;
    }

    this.submitted.emit({ password: cleanPassword, rememberPassword });
  }
}
