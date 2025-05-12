import { Component } from '@angular/core';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatMenuModule } from '@angular/material/menu';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';

@Component({
  standalone: true,
  selector: 'app-header',
  imports: [MatToolbarModule, MatButtonModule, MatMenuModule, RouterModule, MatIconModule],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss']
})
export class HeaderComponent {}
