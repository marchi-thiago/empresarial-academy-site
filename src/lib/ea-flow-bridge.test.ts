import { afterEach, describe, expect, it, vi } from "vitest";
import { enviarWhatsappDoSite } from "./ea-flow-bridge";

describe("WhatsApp do lead do site", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("manda o evento pelo canal evolution com o telefone em dígitos e os campos", async () => {
    vi.stubEnv("EA_FLOW_URL", "https://flow.test/");
    vi.stubEnv("EA_FLOW_API_KEY", "k");
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await enviarWhatsappDoSite("site_whatsapp_download", { nome: "Ana", telefone: "(11) 98888-7777", email: "a@b.com", campos: { material: "Painel" } });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://flow.test/api/events/external");
    expect(JSON.parse(init.body)).toMatchObject({
      eventName: "site_whatsapp_download",
      channelType: "evolution",
      contactExternalId: "11988887777",
      customFields: { email: "a@b.com", material: "Painel" },
    });
  });

  it("sem telefone válido não chama o EA Flow", async () => {
    vi.stubEnv("EA_FLOW_URL", "https://flow.test");
    vi.stubEnv("EA_FLOW_API_KEY", "k");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await enviarWhatsappDoSite("site_whatsapp_contato", { nome: "Ana", telefone: "123", email: "a@b.com" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
