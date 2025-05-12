import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatDividerModule } from '@angular/material/divider';
import { CapabilitiesService } from '../../services/capabilities.service';
import { Observable } from 'rxjs';
import { Capabilities } from '../../models/registry.model';

@Component({
  standalone: true,
  selector: 'app-footer',
  imports: [CommonModule, MatToolbarModule, MatDividerModule],
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.scss']
})
export class FooterComponent implements OnInit {
  capabilities$!: Observable<Capabilities>;
  constructor(private capabilitiesService: CapabilitiesService) {}
  ngOnInit(): void {
    this.capabilities$ = this.capabilitiesService.getCapabilities();
  }
}
