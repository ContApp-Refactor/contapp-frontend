import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { RouterModule } from '@angular/router';
import { Router } from '@angular/router';
import { Login } from '../models/login';
import { ButtonModule } from 'primeng/button';
import { PublicFooterComponent } from '../../../PublicSite/public-footer/public-footer.component';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, CommonModule, RouterModule, ButtonModule, PublicFooterComponent],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent {
  loginFail: boolean = false;
  invalidForm: boolean = false;
  showPassword: boolean = false;

  togglePassword() { this.showPassword = !this.showPassword; }

  authService: AuthService = inject(AuthService);

  constructor(public router: Router) {}

  loginForm = new FormGroup({
    username: new FormControl(environment.defaultLoginUsername ?? '', [Validators.required]),
    password: new FormControl('', [Validators.required]),
  });

  onSubmit() {
    if (!this.loginForm.valid) return;

    const login: Login = {
      username: this.loginForm.value.username || '',
      password: this.loginForm.value.password || '',
    };

    this.authService.login(login).subscribe();
  }
}
