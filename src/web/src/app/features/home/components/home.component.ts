import { Component } from '@angular/core';

type HomeFeature = {
  label: string;
  title: string;
  description: string;
};

@Component({
  selector: 'app-home',
  standalone: false,
  templateUrl: './home.component.html',
  styleUrls: ['../styles/home.styles.css'],
})
export class HomeComponent {
  features: HomeFeature[] = [
    {
      label: '01',
      title: 'Build overlays',
      description: 'Compose stream-ready layouts with text, images, video, and live game stats.',
    },
    {
      label: '02',
      title: 'Manage hubs',
      description: 'Keep multiple broadcast setups organized for matches, teams, and content formats.',
    },
    {
      label: '03',
      title: 'Go live faster',
      description: 'Move from setup to production with focused controls and clean preview surfaces.',
    },
  ];
}
