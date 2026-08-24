import { Component, Input } from '@angular/core';

import { EditorStore } from '../editor.store';
import {
  LayerType,
  PlayerScoreLayer,
  PlayerScoreRole,
  StatLayer,
  StatLayerTeam,
} from '../../../../shared/types/layer.types';

@Component({
  selector: 'app-stat-editor',
  standalone: false,
  template: `
    <section class="inspector-section" aria-label="Stat settings">
      @if(hasTeamLayer()) {
      <label class="field-label">
        Team
        <select class="field-input" [value]="getTeamValue()" (change)="updateTeam($event)">
          <option value="blue">Blue</option>
          <option value="red">Red</option>
        </select>
      </label>
      }

      @if(isPlayerScoreLayer()) {
      <label class="field-label">
        Player
        <select class="field-input" [value]="getRoleValue()" (change)="updateRole($event)">
          @for(role of roleOptions; track role.value) {
          <option [value]="role.value">{{ role.label }}</option>
          }
        </select>
      </label>
      }
    </section>
  `,
})
export class StatEditorComponent {
  @Input({ required: true }) layer!: StatLayer;

  readonly defaultTeam: StatLayerTeam = 'blue';
  readonly defaultRole: PlayerScoreRole = 'top';
  readonly roleOptions: Array<{ value: PlayerScoreRole; label: string }> = [
    { value: 'top', label: 'Top' },
    { value: 'jungle', label: 'Jungle' },
    { value: 'mid', label: 'Mid' },
    { value: 'adc', label: 'ADC' },
    { value: 'support', label: 'Support' },
  ];

  constructor(private editorStore: EditorStore) {}

  hasTeamLayer(): this is { layer: Extract<StatLayer, { team: StatLayerTeam }> } {
    return 'team' in this.layer;
  }

  isPlayerScoreLayer(): this is { layer: PlayerScoreLayer } {
    return this.layer.type === LayerType.PlayerScore;
  }

  getTeamValue() {
    return this.hasTeamLayer() ? this.layer.team : this.defaultTeam;
  }

  getRoleValue() {
    return this.isPlayerScoreLayer() ? this.layer.role : this.defaultRole;
  }

  updateTeam(event: Event) {
    this.editorStore.updateLayer(this.layer.id, {
      team: getTeamValue(event),
    });
  }

  updateRole(event: Event) {
    this.editorStore.updateLayer(this.layer.id, {
      role: getRoleValue(event),
    });
  }
}

function getTeamValue(event: Event): StatLayerTeam {
  return (event.target as HTMLSelectElement).value === 'red' ? 'red' : 'blue';
}

function getRoleValue(event: Event): PlayerScoreRole {
  const value = (event.target as HTMLSelectElement).value;

  return isPlayerScoreRole(value) ? value : 'top';
}

function isPlayerScoreRole(value: string): value is PlayerScoreRole {
  return (
    value === 'top' ||
    value === 'jungle' ||
    value === 'mid' ||
    value === 'adc' ||
    value === 'support'
  );
}
