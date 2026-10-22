import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { LoginComponent } from './login.component';
import { AuthService } from '../services/auth.service';
import { environment } from '../../../../environments/environment';

describe('LoginComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { login: () => ({ subscribe: () => undefined }) } },
      ],
    });
  });

  it('keeps password empty by default', () => {
    const component = TestBed.createComponent(LoginComponent).componentInstance;
    expect(component.loginForm.get('password')?.value).toBe('');
  });

  it('uses environment default username when configured', () => {
    const component = TestBed.createComponent(LoginComponent).componentInstance;
    expect(component.loginForm.get('username')?.value).toBe(environment.defaultLoginUsername ?? '');
  });
});
