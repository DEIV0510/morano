/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    firstVisit?: boolean;
    auth?: {
      session: import('./lib/auth.ts').SessionRow;
      user: import('./lib/auth.ts').AdminUser;
    };
  }
}
