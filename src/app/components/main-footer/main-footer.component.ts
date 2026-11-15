import { Component, ChangeDetectionStrategy } from '@angular/core';

import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-main-footer',
  imports: [RouterModule],
  templateUrl: './main-footer.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './main-footer.component.css'
})
export class MainFooterComponent {

}
