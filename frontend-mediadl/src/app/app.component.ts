import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from './auth/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, LucideAngularModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit, OnDestroy {
  isMobileMenuOpen = false;
  currentYear = new Date().getFullYear();

  private auth = inject(AuthService);
  private readonly onScrollHandler = this.onScroll.bind(this);

  ngOnInit() {
    // Gestion du scroll pour l'header
    window.addEventListener('scroll', this.onScrollHandler);
    this.onScroll();
  }

  get isAuthed(): boolean {
    return this.auth.isAuthenticated();
  }

  get userLabel(): string {
    const user = this.auth.user;
    if (!user) {
      return 'Invite';
    }
    return user.name || user.email || 'User';
  }

  logout() {
    this.auth.logout();
  }

  ngOnDestroy() {
    window.removeEventListener('scroll', this.onScrollHandler);
  }

  toggleMobileMenu() {
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
  }

  closeMobileMenu() {
    this.isMobileMenuOpen = false;
  }

  onScroll() {
    const header = document.querySelector('.header');
    if (window.scrollY > 50) {
      header?.classList.add('scrolled');
    } else {
      header?.classList.remove('scrolled');
    }
  }
}
