import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ManualEntryEventsService {
  private readonly refreshSource = new Subject<void>();
  readonly refresh$ = this.refreshSource.asObservable();

  refresh(): void {
    this.refreshSource.next();
  }
}
