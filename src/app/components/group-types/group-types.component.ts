import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ModelService } from '../../services/model.service';
import { GroupType } from '../../models/registry.model';

@Component({
  standalone: true,
  selector: 'app-group-types',
  imports: [CommonModule, RouterModule],
  templateUrl: './group-types.component.html',
  styleUrls: ['./group-types.component.scss']
})
export class GroupTypesComponent implements OnInit {
  groupTypes$!: Observable<{ groupType: string; model: GroupType }[]>;
  constructor(private modelService: ModelService) {}
  ngOnInit(): void {
    this.groupTypes$ = this.modelService.getRegistryModel().pipe(
      map(model => Object.entries(model.groups).map(([groupType, model]) => ({ groupType, model })))
    );
  }
}
