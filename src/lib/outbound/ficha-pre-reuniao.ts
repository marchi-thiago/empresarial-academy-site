import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import os from "os";

const execFileAsync = promisify(execFile);

export async function gerarFichaPreReuniao(dossie: any, historicoInteracoes: any[], pontuacao: number): Promise<string> {
  const prompt = `
Gere uma ficha pré-reunião para o Thiago ler antes de entrar na reunião de 20 minutos.
Baseie-se nestes dados do CRM:
Dossiê: ${JSON.stringify(dossie)}
Pontos de engajamento: ${pontuacao}
Interações recentes: ${JSON.stringify(historicoInteracoes.slice(0, 5))}

A ficha deve conter:
- Resumo do dossiê (decisor, empresa)
- Sinais de engajamento
- Dor provável (com base no dossiê/interações)
- Faixa de faturamento provável (pela régua de 0,5% a 2,5% do investimento estimado no setor)
- 3 Perguntas sugeridas para a reunião (SPIN)

Seja direto e prático. Use português brasileiro.
`;

  try {
    const cwd = path.join(os.homedir(), "dev", "empresarial-academy-site");
    const result = await execFileAsync("agy", ["-p", prompt, "--model", "gemini-3.8-flash-medium", "--output-format", "json"]);
    let out = result.stdout;
    // strip markdown ticks if present
    out = out.replace(/^```json\n/, "").replace(/\n```$/, "");
    const parsed = JSON.parse(out);
    return parsed.ficha || parsed.texto || out;
  } catch (error) {
    console.error("Erro ao gerar ficha com Antigravity:", error);
    return "Falha ao gerar ficha. Veja o dossiê manualmente no CRM.";
  }
}
