import { Component, Input } from '@angular/core';

import { getItemImageUrl, getPreviewPlayer, getPreviewTeam, LOL_ROLE_OPTIONS } from '../../../../shared/data/league-preview-data';
import { EditorStore } from '../editor.store';
import {
  ChampionPortraitLayer,
  ChampionPortraitShape,
  LayerType,
  LolPlayerRosterLayer,
  LolScorebugLayer,
  PlayerItemsLayer,
  PlayerScoreRole,
  StatLayer,
  StatLayerTeam,
} from '../../../../shared/types/layer.types';

type EditableTeamStat = 'kills' | 'gold' | 'towers' | 'dragons' | 'voidGrubs' | 'riftHerald';
type EditablePlayerNumber = 'level' | 'kills' | 'deaths' | 'assists' | 'creepScore' | 'gold';
type EditablePlayerText = 'name' | 'championName' | 'championId' | 'championImageUrl';

@Component({
  selector: 'app-stat-editor',
  standalone: false,
  template: `
    <section class="inspector-section" aria-label="League data settings">
      @if(hasTeamLayer()) {
      <label class="field-label">
        Team
        <select class="field-input" [value]="getTeamValue()" (change)="updateTeam($event)">
          <option value="blue">Blue</option>
          <option value="red">Red</option>
        </select>
      </label>
      }

      @if(isPlayerBoundLayer()) {
      <label class="field-label">
        Player
        <select class="field-input" [value]="getRoleValue()" (change)="updateRole($event)">
          @for(role of roleOptions; track role.value) {
          <option [value]="role.value">{{ role.label }}</option>
          }
        </select>
      </label>
      }

      @if(isPlayerItemsLayer()) {
      <label class="toggle-field">
        <input type="checkbox" [checked]="layer.showTrinket" (change)="updateShowTrinket($event)" />
        Show trinket slot
      </label>
      }

      @if(isChampionPortraitLayer()) {
      <div class="field-grid">
        <label class="field-label">
          Shape
          <select class="field-input" [value]="layer.shape" (change)="updatePortraitShape($event)">
            <option value="square">Square</option>
            <option value="circle">Circle</option>
            <option value="banner">Banner</option>
          </select>
        </label>

        <label class="toggle-field">
          <input type="checkbox" [checked]="layer.showLevel" (change)="updateShowLevel($event)" />
          Level
        </label>
      </div>
      }

      @if(isScorebugLayer()) {
      <div class="field-grid">
        <label class="field-label">
          Blue code
          <input class="field-input" type="text" [value]="layer.blueTeamCode" (input)="updateScorebugText('blueTeamCode', $event)" />
        </label>

        <label class="field-label">
          Red code
          <input class="field-input" type="text" [value]="layer.redTeamCode" (input)="updateScorebugText('redTeamCode', $event)" />
        </label>

        <label class="field-label">
          Blue accent
          <input class="field-input field-input-color" type="color" [value]="layer.blueAccent" (input)="updateScorebugText('blueAccent', $event)" />
        </label>

        <label class="field-label">
          Red accent
          <input class="field-input field-input-color" type="color" [value]="layer.redAccent" (input)="updateScorebugText('redAccent', $event)" />
        </label>
      </div>

      <div class="toggle-grid">
        <label class="toggle-field">
          <input type="checkbox" [checked]="layer.showGold" (change)="updateScorebugToggle('showGold', $event)" />
          Team gold
        </label>
        <label class="toggle-field">
          <input type="checkbox" [checked]="layer.showObjectives" (change)="updateScorebugToggle('showObjectives', $event)" />
          Objectives
        </label>
        <label class="toggle-field">
          <input type="checkbox" [checked]="layer.showGameTime" (change)="updateScorebugToggle('showGameTime', $event)" />
          Game time
        </label>
      </div>

      <label class="field-label">
        Game time
        <input class="field-input" type="text" [value]="layer.gameTime || '11:28'" (change)="updateScorebugGameTime($event)" />
      </label>

      @for(team of teamSides; track team) {
      <details class="data-subsection">
      <summary>{{ team === 'blue' ? 'Blue' : 'Red' }} team statistics</summary>
      <div class="field-grid">
        <label class="field-label">
          Seed
          <input class="field-input" type="text" [value]="getScorebugSeed(team)" (change)="updateScorebugSeed(team, $event)" />
        </label>
        <label class="field-label">
          Kills
          <input class="field-input" type="number" min="0" [value]="getScorebugStat(team, 'kills')" (change)="updateScorebugStat(team, 'kills', $event)" />
        </label>
        <label class="field-label">
          Gold
          <input class="field-input" type="number" min="0" [value]="getScorebugStat(team, 'gold')" (change)="updateScorebugStat(team, 'gold', $event)" />
        </label>
        <label class="field-label">
          Towers
          <input class="field-input" type="number" min="0" [value]="getScorebugStat(team, 'towers')" (change)="updateScorebugStat(team, 'towers', $event)" />
        </label>
        <label class="field-label">
          Dragons
          <input class="field-input" type="number" min="0" [value]="getScorebugStat(team, 'dragons')" (change)="updateScorebugStat(team, 'dragons', $event)" />
        </label>
        <label class="field-label">
          Void grubs
          <input class="field-input" type="number" min="0" [value]="getScorebugStat(team, 'voidGrubs')" (change)="updateScorebugStat(team, 'voidGrubs', $event)" />
        </label>
        <label class="field-label">
          Herald
          <input class="field-input" type="number" min="0" [value]="getScorebugStat(team, 'riftHerald')" (change)="updateScorebugStat(team, 'riftHerald', $event)" />
        </label>
      </div>
      </details>
      }
      }

      @if(isRosterLayer()) {
      <label class="field-label">
        Orientation
        <select class="field-input" [value]="layer.orientation" (change)="updateRosterOrientation($event)">
          <option value="left">Left aligned</option>
          <option value="right">Right aligned</option>
        </select>
      </label>

      <div class="toggle-grid">
        <label class="toggle-field">
          <input type="checkbox" [checked]="layer.showChampion" (change)="updateRosterToggle('showChampion', $event)" />
          Portraits
        </label>

        <label class="toggle-field">
          <input type="checkbox" [checked]="layer.showLevel" (change)="updateRosterToggle('showLevel', $event)" />
          Levels
        </label>

        <label class="toggle-field">
          <input type="checkbox" [checked]="layer.showKda" (change)="updateRosterToggle('showKda', $event)" />
          KDA
        </label>

        <label class="toggle-field">
          <input type="checkbox" [checked]="layer.showCs" (change)="updateRosterToggle('showCs', $event)" />
          CS
        </label>

        <label class="toggle-field">
          <input type="checkbox" [checked]="layer.showGold" (change)="updateRosterToggle('showGold', $event)" />
          Gold
        </label>

        <label class="toggle-field">
          <input type="checkbox" [checked]="layer.showItems" (change)="updateRosterToggle('showItems', $event)" />
          Items
        </label>
      </div>

      <h3 class="inspector-subtitle">Player details</h3>
      <label class="field-label">
        Player
        <select class="field-input" [value]="selectedRosterRole" (change)="selectRosterRole($event)">
          @for(role of roleOptions; track role.value) {
          <option [value]="role.value">{{ role.label }}</option>
          }
        </select>
      </label>
      <label class="toggle-field">
        <input type="checkbox" [checked]="getRosterPlayerVisible()" (change)="updateRosterPlayerVisible($event)" />
        Show player row
      </label>
      <div class="field-grid">
        <label class="field-label">
          Player name
          <input class="field-input" type="text" [value]="getRosterPlayerText('name')" (change)="updateRosterPlayerText('name', $event)" />
        </label>
        <label class="field-label">
          Champion name
          <input class="field-input" type="text" [value]="getRosterPlayerText('championName')" (change)="updateRosterPlayerText('championName', $event)" />
        </label>
        <label class="field-label">
          Champion ID
          <input class="field-input" type="text" [value]="getRosterPlayerText('championId')" (change)="updateRosterPlayerText('championId', $event)" />
        </label>
        <label class="field-label">
          Level
          <input class="field-input" type="number" min="1" [value]="getRosterPlayerNumber('level')" (change)="updateRosterPlayerNumber('level', $event)" />
        </label>
      </div>
      <label class="field-label">
        Champion image URL
        <input class="field-input" type="url" [value]="getRosterPlayerText('championImageUrl')" (change)="updateRosterPlayerText('championImageUrl', $event)" />
      </label>
      <div class="field-grid">
        <label class="field-label">
          CS
          <input class="field-input" type="number" min="0" [value]="getRosterPlayerNumber('creepScore')" (change)="updateRosterPlayerNumber('creepScore', $event)" />
        </label>
        <label class="field-label">
          Gold
          <input class="field-input" type="number" min="0" [value]="getRosterPlayerNumber('gold')" (change)="updateRosterPlayerNumber('gold', $event)" />
        </label>
        <label class="field-label">
          Kills
          <input class="field-input" type="number" min="0" [value]="getRosterPlayerNumber('kills')" (change)="updateRosterPlayerNumber('kills', $event)" />
        </label>
        <label class="field-label">
          Deaths
          <input class="field-input" type="number" min="0" [value]="getRosterPlayerNumber('deaths')" (change)="updateRosterPlayerNumber('deaths', $event)" />
        </label>
        <label class="field-label">
          Assists
          <input class="field-input" type="number" min="0" [value]="getRosterPlayerNumber('assists')" (change)="updateRosterPlayerNumber('assists', $event)" />
        </label>
      </div>
      <h3 class="inspector-subtitle">Items</h3>
      <div class="item-editor-grid" aria-label="Six item slots">
        @for(itemId of getRosterItems(); track $index; let index = $index) {
        <div class="item-editor-slot">
          @if(itemId) { <img [src]="getItemImageUrl(itemId)" alt="" /> }
          <input class="field-input" type="number" min="1" [attr.aria-label]="'Item ' + (index + 1) + ' ID'"
            [value]="itemId || ''" (change)="updateRosterItemId(index, $event)" />
        </div>
        }
      </div>
      }
    </section>
  `,
})
export class StatEditorComponent {
  @Input({ required: true }) layer!: StatLayer;

  readonly defaultTeam: StatLayerTeam = 'blue';
  readonly defaultRole: PlayerScoreRole = 'top';
  readonly roleOptions = LOL_ROLE_OPTIONS;
  readonly teamSides: StatLayerTeam[] = ['blue', 'red'];
  readonly getItemImageUrl = getItemImageUrl;
  selectedRosterRole: PlayerScoreRole = 'top';

  constructor(private editorStore: EditorStore) {}

  hasTeamLayer(): this is { layer: Extract<StatLayer, { team: StatLayerTeam }> } {
    return 'team' in this.layer;
  }

  isPlayerBoundLayer(): this is { layer: Extract<StatLayer, { role: PlayerScoreRole }> } {
    return 'role' in this.layer;
  }

  isPlayerItemsLayer(): this is { layer: PlayerItemsLayer } {
    return this.layer.type === LayerType.PlayerItems;
  }

  isChampionPortraitLayer(): this is { layer: ChampionPortraitLayer } {
    return this.layer.type === LayerType.ChampionPortrait;
  }

  isScorebugLayer(): this is { layer: LolScorebugLayer } {
    return this.layer.type === LayerType.LolScorebug;
  }

  isRosterLayer(): this is { layer: LolPlayerRosterLayer } {
    return this.layer.type === LayerType.LolPlayerRoster;
  }

  getTeamValue() {
    return this.hasTeamLayer() ? this.layer.team : this.defaultTeam;
  }

  getRoleValue() {
    return this.isPlayerBoundLayer() ? this.layer.role : this.defaultRole;
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

  updateShowTrinket(event: Event) {
    this.editorStore.updateLayer(this.layer.id, {
      showTrinket: getCheckedValue(event),
    });
  }

  updatePortraitShape(event: Event) {
    this.editorStore.updateLayer(this.layer.id, {
      shape: getPortraitShapeValue(event),
    });
  }

  updateShowLevel(event: Event) {
    this.editorStore.updateLayer(this.layer.id, {
      showLevel: getCheckedValue(event),
    });
  }

  updateScorebugText(key: 'blueTeamCode' | 'redTeamCode' | 'blueAccent' | 'redAccent', event: Event) {
    this.editorStore.updateLayer(this.layer.id, {
      [key]: getInputValue(event),
    });
  }

  updateScorebugToggle(key: 'showGold' | 'showObjectives' | 'showGameTime', event: Event) {
    this.editorStore.updateLayer(this.layer.id, {
      [key]: getCheckedValue(event),
    });
  }

  getScorebugSeed(team: StatLayerTeam) {
    return this.isScorebugLayer() ? this.layer.teamStats?.[team]?.seed ?? getPreviewTeam(team).seed : '';
  }

  getScorebugStat(team: StatLayerTeam, key: EditableTeamStat) {
    return this.isScorebugLayer() ? this.layer.teamStats?.[team]?.[key] ?? getPreviewTeam(team)[key] : 0;
  }

  updateScorebugGameTime(event: Event) {
    this.editorStore.updateLayer(this.layer.id, { gameTime: getInputValue(event) });
  }

  updateScorebugSeed(team: StatLayerTeam, event: Event) {
    this.updateTeamStats(team, { seed: getInputValue(event) });
  }

  updateScorebugStat(team: StatLayerTeam, key: EditableTeamStat, event: Event) {
    this.updateTeamStats(team, { [key]: getNonnegativeNumber(event) });
  }

  private updateTeamStats(team: StatLayerTeam, changes: Record<string, string | number>) {
    if (!this.isScorebugLayer()) return;
    this.editorStore.updateLayer(this.layer.id, {
      teamStats: {
        ...this.layer.teamStats,
        [team]: { ...this.layer.teamStats?.[team], ...changes },
      },
    });
  }

  updateRosterOrientation(event: Event) {
    this.editorStore.updateLayer(this.layer.id, {
      orientation: getInputValue(event) === 'right' ? 'right' : 'left',
    });
  }

  updateRosterToggle(
    key: 'showChampion' | 'showLevel' | 'showKda' | 'showCs' | 'showGold' | 'showItems',
    event: Event,
  ) {
    this.editorStore.updateLayer(this.layer.id, {
      [key]: getCheckedValue(event),
    });
  }

  selectRosterRole(event: Event) {
    this.selectedRosterRole = getRoleValue(event);
  }

  getRosterPlayerText(key: EditablePlayerText) {
    if (!this.isRosterLayer()) return '';
    return this.layer.playerOverrides?.[this.selectedRosterRole]?.[key]
      ?? getPreviewPlayer(this.layer.team, this.selectedRosterRole)[key]
      ?? '';
  }

  getRosterPlayerNumber(key: EditablePlayerNumber) {
    if (!this.isRosterLayer()) return 0;
    return this.layer.playerOverrides?.[this.selectedRosterRole]?.[key]
      ?? getPreviewPlayer(this.layer.team, this.selectedRosterRole)[key];
  }

  getRosterPlayerVisible() {
    return this.isRosterLayer() && this.layer.playerOverrides?.[this.selectedRosterRole]?.visible !== false;
  }

  getRosterItems() {
    if (!this.isRosterLayer()) return Array<number | null>(6).fill(null);
    const items = this.layer.playerOverrides?.[this.selectedRosterRole]?.items
      ?? getPreviewPlayer(this.layer.team, this.selectedRosterRole).items.map((item) => item.id);
    return Array.from({ length: 6 }, (_, index) => items[index] ?? null);
  }

  updateRosterPlayerText(key: EditablePlayerText, event: Event) {
    this.updateRosterPlayer({ [key]: getInputValue(event) });
  }

  updateRosterPlayerNumber(key: EditablePlayerNumber, event: Event) {
    this.updateRosterPlayer({ [key]: getNonnegativeNumber(event) });
  }

  updateRosterPlayerVisible(event: Event) {
    this.updateRosterPlayer({ visible: getCheckedValue(event) });
  }

  updateRosterItemId(index: number, event: Event) {
    const items = this.getRosterItems();
    const value = Number(getInputValue(event));
    items[index] = Number.isInteger(value) && value > 0 ? value : null;
    this.updateRosterPlayer({ items });
  }

  private updateRosterPlayer(changes: Record<string, unknown>) {
    if (!this.isRosterLayer()) return;
    this.editorStore.updateLayer(this.layer.id, {
      playerOverrides: {
        ...this.layer.playerOverrides,
        [this.selectedRosterRole]: {
          ...this.layer.playerOverrides?.[this.selectedRosterRole],
          ...changes,
        },
      },
    });
  }
}

function getInputValue(event: Event) {
  return (event.target as HTMLInputElement | HTMLSelectElement).value;
}

function getCheckedValue(event: Event) {
  return (event.target as HTMLInputElement).checked;
}

function getNonnegativeNumber(event: Event) {
  return Math.max(0, Number(getInputValue(event)) || 0);
}

function getTeamValue(event: Event): StatLayerTeam {
  return getInputValue(event) === 'red' ? 'red' : 'blue';
}

function getRoleValue(event: Event): PlayerScoreRole {
  const value = getInputValue(event);

  return isPlayerScoreRole(value) ? value : 'top';
}

function getPortraitShapeValue(event: Event): ChampionPortraitShape {
  const value = getInputValue(event);

  if (value === 'circle' || value === 'banner') {
    return value;
  }

  return 'square';
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
