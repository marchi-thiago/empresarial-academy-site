r"""Gera as imagens do e-mail outbound (F7) em public/email/.

Fontes (fora do repositório): logo canônico de fundo azul-marinho e retrato do Thiago em
D:\Empresarial Academy\Projeto IA\Institucional Empresarial Academy. Capas dos vídeos: public/images.
Uso: python scripts/email-outbound-imagens.py   (precisa de Pillow)
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

RAIZ = Path(__file__).resolve().parent.parent
INST = Path(r"D:\Empresarial Academy\Projeto IA\Institucional Empresarial Academy")
SAIDA = RAIZ / "public" / "email"
SAIDA.mkdir(parents=True, exist_ok=True)
ARQ = {"fabio": "depoimento-fabio-ramos.jpg", "daniella": "depoimento-daniella-higa.jpg", "erik": "depoimento-erik-dantas.jpg"}
NAVY = (0x1D, 0x2B, 0x3C)  # --color-navy do site; a faixa do e-mail usa a mesma cor
GOLD = (0xC1, 0xA1, 0x60)


def dourado_sobre(img, fundo):
    """Extrai o dourado do logo (fundo azul tem R<B, dourado tem R>B) e compõe sobre cor chapada."""
    rgb = img.convert("RGB")
    out = Image.new("RGB", rgb.size, fundo)
    mascara = Image.new("L", rgb.size)
    mp, px = mascara.load(), rgb.load()
    for y in range(rgb.height):
        for x in range(rgb.width):
            r, _, b = px[x, y]
            mp[x, y] = max(0, min(255, int((r - b + 5) * 255 / 70)))
    out.paste(Image.new("RGB", rgb.size, GOLD), mask=mascara)
    return out


def faixa_logo():
    # 80 px de altura = 40 px exibidos em tela 2x. Monograma + nome, recortados do logo canônico.
    logo = Image.open(INST / "Logo Empresarial Academy.png")
    selo = dourado_sobre(logo.crop((455, 260, 975, 780)), NAVY).resize((72, 72), Image.LANCZOS)
    nome = dourado_sobre(logo.crop((140, 860, 1310, 1130)), NAVY)
    nome = nome.resize((int(nome.width * 64 / nome.height), 64), Image.LANCZOS)
    tela = Image.new("RGB", (selo.width + 22 + nome.width, 80), NAVY)
    tela.paste(selo, (0, 4))
    tela.paste(nome, (selo.width + 22, 8))
    tela.quantize(32).save(SAIDA / "logo-faixa.png", optimize=True)


def play(tela, cx, cy, r):
    d = ImageDraw.Draw(tela, "RGBA")
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(29, 43, 60, 215), outline=GOLD, width=4)
    t = r * 0.46
    d.polygon([(cx - t * 0.7, cy - t * 1.05), (cx - t * 0.7, cy + t * 1.05), (cx + t * 1.15, cy)], fill=GOLD)


def capa(nome, y0):
    foto = Image.open(RAIZ / "public" / "images" / ARQ[nome]).convert("RGB")
    corte = foto.crop((0, y0, 480, y0 + 300)).resize((600, 375), Image.LANCZOS)
    play(corte, 300, 290, 46)
    corte.save(SAIDA / f"capa-{nome}.jpg", quality=76, optimize=True, progressive=True)


def capa_demo():
    # Sem vídeo de demo gravado ainda: cartão navy com o monograma e o play.
    logo = Image.open(INST / "Logo Empresarial Academy.png")
    selo = dourado_sobre(logo.crop((455, 260, 975, 780)), NAVY).resize((150, 150), Image.LANCZOS)
    tela = Image.new("RGB", (600, 375), NAVY)
    tela.paste(selo, (95, 112))
    play(tela, 430, 187, 46)
    tela.quantize(32).convert("RGB").save(SAIDA / "capa-demo.jpg", quality=80, optimize=True)


def retrato():
    foto = Image.open(INST / "thiago-portrait.jpg").convert("RGB").crop((530, 150, 2060, 1680)).resize((144, 144), Image.LANCZOS)
    fundo = Image.new("RGBA", (144, 144), (0, 0, 0, 0))
    mascara = Image.new("L", (576, 576), 0)
    ImageDraw.Draw(mascara).ellipse((0, 0, 575, 575), fill=255)
    fundo.paste(foto, (0, 0), mascara.resize((144, 144), Image.LANCZOS))
    fundo.quantize(128, method=Image.FASTOCTREE).save(SAIDA / "thiago.png", optimize=True)


faixa_logo()
capa("fabio", 255)
capa("daniella", 240)
capa("erik", 230)
capa_demo()
retrato()
for p in sorted(SAIDA.iterdir()):
    print(p.name, p.stat().st_size)
