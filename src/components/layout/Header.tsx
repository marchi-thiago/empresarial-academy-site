"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { mainNav, servicosMenu, siteConfig } from "@/lib/site-config";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { cn } from "@/lib/utils";

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [megaOpen, setMegaOpen] = useState(false);
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    // Cabeçalho navy: o logo tem fundo #12263b, praticamente este mesmo navy —
    // sobre branco ele lia como um adesivo recortado (pior no celular, logo
    // acima do herói navy). No navy ele funde e o dourado ganha destaque.
    // O fio dourado inferior separa o header do conteúdo sem cortar o logo.
    <header className="sticky top-0 z-50 border-b border-gold/30 bg-navy/95 text-white backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2" aria-label={`${siteConfig.name} — início`}>
          <Image
            src="/logo-empresarial-academy.png"
            alt=""
            width={64}
            height={61}
            className="h-14 w-auto"
            priority
          />
        </Link>

        {/* Nav desktop */}
        <nav className="hidden items-center gap-1 xl:flex" aria-label="Menu principal">
          {mainNav.map((item) =>
            item.label === "Serviços" ? (
              <div
                key={item.href}
                className="relative"
                onMouseEnter={() => setMegaOpen(true)}
                onMouseLeave={() => setMegaOpen(false)}
              >
                <Link
                  href={item.href}
                  aria-expanded={megaOpen}
                  aria-current={isActive(item.href) ? "page" : undefined}
                  className={cn(
                    "whitespace-nowrap rounded-md px-3 py-2 text-base font-medium transition-colors hover:text-gold",
                    isActive(item.href) ? "text-gold" : "text-white/90",
                  )}
                >
                  {item.label}
                </Link>
                {megaOpen && (
                  <div className="absolute left-1/2 top-full w-[34rem] -translate-x-1/2 pt-2">
                    <div className="grid grid-cols-2 gap-1 rounded-xl border border-line bg-white p-3 shadow-xl">
                      {servicosMenu.map((s) => (
                        <Link
                          key={s.href}
                          href={s.href}
                          className="flex gap-3 rounded-lg p-3 transition-colors hover:bg-surface"
                        >
                          <Icon name={s.icon} className="mt-0.5 h-6 w-6 shrink-0 text-gold-ink" />
                          <span>
                            <span className="block text-sm font-semibold text-navy">
                              {s.title}
                            </span>
                            <span className="block text-xs text-gray">{s.desc}</span>
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(item.href) ? "page" : undefined}
                className={cn(
                  "whitespace-nowrap rounded-md px-3 py-2 text-base font-medium transition-colors hover:text-gold",
                  isActive(item.href) ? "text-gold" : "text-white/90",
                )}
              >
                {item.label}
              </Link>
            ),
          )}
        </nav>

        <div className="hidden items-center gap-1 xl:flex">
          <ThemeToggle className="text-white/90 hover:bg-white/10 hover:text-gold" />
          <Link
            href="/busca"
            aria-label="Buscar no site"
            className="flex h-11 w-11 items-center justify-center rounded-md text-white/90 transition-colors hover:text-gold"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
              <path d="M21 21l-4.3-4.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </Link>
          <Button href="/diagnostico-maturidade-empresarial.html" external variant="primary" size="sm">
            Diagnóstico Gratuito
          </Button>
        </div>

        {/* Ações mobile — tema fica fora do menu, alcançável com uma mão */}
        <div className="flex items-center gap-1 xl:hidden">
          <ThemeToggle className="text-white/90 hover:bg-white/10 hover:text-gold" />
        <button
          type="button"
          className="inline-flex h-11 w-11 items-center justify-center rounded-md text-white"
          aria-label={mobileOpen ? "Fechar menu" : "Abrir menu"}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((v) => !v)}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
            {mobileOpen ? (
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            ) : (
              <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            )}
          </svg>
        </button>
        </div>
      </div>

      {/* Menu mobile */}
      {mobileOpen && (
        <nav
          className="border-t border-white/10 bg-navy xl:hidden"
          aria-label="Menu principal (mobile)"
        >
          <ul className="mx-auto max-w-6xl px-6 py-3">
            {mainNav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  aria-current={isActive(item.href) ? "page" : undefined}
                  className={cn(
                    "block rounded-md px-2 py-3 text-base font-medium transition-colors hover:bg-white/10",
                    isActive(item.href) ? "text-gold" : "text-white/90",
                  )}
                >
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <Link
                href="/busca"
                onClick={() => setMobileOpen(false)}
                className="block rounded-md px-2 py-3 text-base font-medium text-white/90 transition-colors hover:bg-white/10"
              >
                Buscar
              </Link>
            </li>
            <li className="pt-2">
              <Button href="/diagnostico-maturidade-empresarial.html" external variant="primary" size="md" className="w-full">
                Diagnóstico Gratuito
              </Button>
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}
