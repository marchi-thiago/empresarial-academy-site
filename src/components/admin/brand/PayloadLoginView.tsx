import type { AdminViewServerProps } from "payload";
import { redirect } from "next/navigation";
import { SystemLogo } from "./SystemLogo";
import { PayloadLoginForm } from "./PayloadLoginForm";

/**
 * Tela de login própria, no lugar da tela nativa do Payload — padrão
 * unificado nos sistemas Payload da EA (site/EA HUB, EA Post, EA Flow).
 *
 * Layout em duas colunas (05/09/2026): o card único empilhava logo, tagline,
 * dois campos, a caixa de confiança e o rodapé numa coluna só, e em notebook
 * isso não cabia na altura — a correção anterior (rolagem + margin auto) fez
 * caber, mas rolar para logar continua ruim. Dividir em duas colunas usa a
 * largura, que sobra, em vez da altura, que falta: a identidade vai para o
 * painel esquerdo e o formulário fica sozinho à direita, curto o bastante
 * para caber inteiro sem rolagem.
 *
 * Abaixo de 900px o grid vira uma coluna e o painel de marca colapsa numa
 * faixa horizontal — em celular a altura volta a ser o recurso escasso, e
 * uma faixa de marca custa menos que meia tela de painel.
 */
export function PayloadLoginView({ systemName, tagline }: { systemName: string; tagline: string }) {
  return function LoginViewForSystem({ initPageResult, searchParams }: AdminViewServerProps) {
    const { req } = initPageResult;
    if (req.user) {
      redirect(req.payload.config.routes.admin);
    }

    const { routes, admin } = req.payload.config;
    const userSlug = admin.user;
    const forgotRoute = `${routes.admin}${routes.admin.endsWith("/") ? "" : "/"}forgot`.replace(/\/{2,}/g, "/");
    const redirectParam = typeof searchParams?.redirect === "string" ? `?redirect=${encodeURIComponent(searchParams.redirect)}` : "";

    return (
      <div className="ea-login-shell">
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Sora:wght@600;700&display=swap');
          body { background: #FFFFFF; margin: 0; }

          .ea-login-shell {
            position: fixed;
            inset: 0;
            display: grid;
            grid-template-columns: minmax(320px, 42%) 1fr;
            font-family: 'Inter', system-ui, -apple-system, sans-serif;
            overflow-y: auto;
          }

          /* Painel de marca. O gradiente e a textura ficam aqui, não atrás do
             formulário: fundo decorado sob campo de texto atrapalha a leitura. */
          .ea-login-brand {
            position: relative;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            gap: 2rem;
            padding: 3rem 3.25rem;
            background:
              radial-gradient(900px 500px at 15% 0%, rgba(201,154,62,0.16) 0%, rgba(201,154,62,0) 65%),
              linear-gradient(160deg, #24374C 0%, #1D2B3C 55%, #16212E 100%);
            color: #FFFFFF;
            overflow: hidden;
          }

          /* Fio dourado na divisa das colunas — a única borda da tela, o que
             deixa a separação nítida sem desenhar caixa em volta de nada. */
          .ea-login-brand::after {
            content: "";
            position: absolute;
            top: 0;
            right: 0;
            bottom: 0;
            width: 1px;
            background: linear-gradient(180deg, rgba(201,154,62,0) 0%, #C99A3E 45%, rgba(201,154,62,0) 100%);
          }

          /* Arco concêntrico, bem apagado: dá profundidade ao painel sem virar
             ilustração competindo com o logo. */
          .ea-login-brand::before {
            content: "";
            position: absolute;
            right: -18%;
            bottom: -22%;
            width: 78%;
            aspect-ratio: 1;
            border-radius: 50%;
            border: 1px solid rgba(201,154,62,0.18);
            box-shadow: 0 0 0 42px rgba(201,154,62,0.05);
            pointer-events: none;
          }

          .ea-login-brand-top,
          .ea-login-brand-bottom {
            position: relative;
            z-index: 1;
          }

          .ea-login-tagline {
            margin: 1.5rem 0 0;
            font-family: 'Sora', 'Inter', sans-serif;
            font-size: clamp(1.35rem, 1.1rem + 0.9vw, 1.95rem);
            font-weight: 700;
            line-height: 1.28;
            letter-spacing: -0.02em;
            max-width: 22ch;
          }

          .ea-login-slogan {
            margin: 0.85rem 0 0;
            font-size: 0.92rem;
            color: rgba(255,255,255,0.62);
            font-weight: 500;
            letter-spacing: 0.01em;
          }

          .ea-login-seal {
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.45rem 0.85rem;
            border: 1px solid rgba(201,154,62,0.35);
            border-radius: 999px;
            font-size: 0.76rem;
            font-weight: 600;
            color: rgba(255,255,255,0.82);
            background: rgba(255,255,255,0.04);
          }

          .ea-login-seal-dot {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: #C99A3E;
            box-shadow: 0 0 0 3px rgba(201,154,62,0.22);
          }

          /* Coluna do formulario. align-items:center com overflow-y:auto
             cortaria o topo quando nao coubesse; margin:auto no filho
             centraliza so enquanto sobra espaco (defeito corrigido em
             05/09/2026, nao reintroduzir). */
          .ea-login-panel {
            display: flex;
            flex-direction: column;
            padding: 2rem 2.5rem;
            background: linear-gradient(180deg, #FAFAF7 0%, #FFFFFF 100%);
            overflow-y: auto;
          }

          .ea-login-panel-inner {
            width: 100%;
            max-width: 348px;
            margin: auto;
            display: flex;
            flex-direction: column;
            gap: 1.4rem;
          }

          .ea-login-welcome {
            display: flex;
            flex-direction: column;
            gap: 0.3rem;
          }

          .ea-login-welcome h1 {
            margin: 0;
            font-family: 'Sora', 'Inter', sans-serif;
            font-size: 1.4rem;
            font-weight: 700;
            color: #1D2B3C;
            letter-spacing: -0.02em;
          }

          .ea-login-welcome p {
            margin: 0;
            font-size: 0.86rem;
            color: #5B6472;
          }

          .ea-login-footnote {
            margin: 0;
            font-size: 0.72rem;
            color: #8A93A0;
            text-align: center;
          }

          /* Faixa de marca só no topo em telas estreitas: em celular a altura
             volta a ser escassa, e meia tela de painel empurraria o formulário
             para fora. */
          @media (max-width: 900px) {
            .ea-login-shell {
              grid-template-columns: 1fr;
              grid-template-rows: auto 1fr;
            }
            .ea-login-brand {
              flex-direction: row;
              align-items: center;
              justify-content: space-between;
              gap: 1rem;
              padding: 1.25rem 1.5rem;
            }
            .ea-login-brand::before,
            .ea-login-brand-bottom { display: none; }
            .ea-login-brand::after {
              top: auto;
              left: 0;
              right: 0;
              bottom: 0;
              width: auto;
              height: 1px;
              background: linear-gradient(90deg, rgba(201,154,62,0) 0%, #C99A3E 50%, rgba(201,154,62,0) 100%);
            }
            .ea-login-tagline {
              margin: 0;
              font-size: 0.95rem;
              line-height: 1.35;
              max-width: 26ch;
            }
            .ea-login-slogan { display: none; }
            .ea-login-panel { padding: 1.75rem 1.5rem; }
          }

          @media (max-width: 560px) {
            .ea-login-tagline { display: none; }
            .ea-login-brand { justify-content: center; }
          }
        `}</style>

        <aside className="ea-login-brand">
          <div className="ea-login-brand-top">
            <SystemLogo systemName={systemName} size={112} glow={false} />
            <p className="ea-login-tagline">{tagline}</p>
            <p className="ea-login-slogan">Conhecimento que Impulsiona</p>
          </div>

          <div className="ea-login-brand-bottom">
            <span className="ea-login-seal">
              <span className="ea-login-seal-dot" aria-hidden />
              Ambiente seguro e criptografado
            </span>
          </div>
        </aside>

        <main className="ea-login-panel">
          <div className="ea-login-panel-inner">
            <div className="ea-login-welcome">
              <h1>Acessar sua conta</h1>
              <p>Entre com suas credenciais da Empresarial Academy.</p>
            </div>

            <PayloadLoginForm
              userSlug={userSlug}
              apiRoute={routes.api}
              adminRoute={routes.admin}
              forgotRoute={`${forgotRoute}${redirectParam}`}
            />

            <p className="ea-login-footnote">Empresarial Academy · uso restrito a pessoas autorizadas</p>
          </div>
        </main>
      </div>
    );
  };
}
