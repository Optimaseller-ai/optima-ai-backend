import "server-only";

import { norm } from "@/lib/agents/seller-language";

export type ProspectSocialCues = {
  frustrationWithAgent: boolean;
  confusion: boolean;
  sarcasmLikely: boolean;
  satisfaction: boolean;
  buyingSignal: boolean;
};

export function detectProspectSocialCues(message: string): ProspectSocialCues {
  const t = norm(message).toLowerCase();
  if (!t) {
    return {
      frustrationWithAgent: false,
      confusion: false,
      sarcasmLikely: false,
      satisfaction: false,
      buyingSignal: false,
    };
  }

  const frustrationWithAgent =
    /\b(trop\s+d['’']?erreurs|beaucoup\s+d['’']?erreurs|tu\s+fais\s+(trop\s+)?d['’']?erreurs|vous\s+faites\s+(trop\s+)?d['’']?erreurs|vous\s+vous\s+trompez|tu\s+te\s+trompes|vous\s+avez\s+tor|tu\s+as\s+tor|vous\s+ne\s+servez\s+à\s+rien|ça\s+ne\s+va\s+pas|incohérent|n['’']?importe\s+quoi)\b/i.test(
      t,
    ) || /\b(you\s+keep\s+making\s+mistakes|you\s+are\s+wrong)\b/i.test(t);

  const confusion =
    /\b(je\s+comprends\s+pas|je\s+n['’']?ai\s+pas\s+compris|c['’']?est\s+pas\s+clair|pas\s+clair|expliquez\s+mieux|vous\s+parlez\s+de\s+quoi|i\s+don['’']?t\s+understand|not\s+clear)\b/i.test(
      t,
    );

  const sarcasmLikely =
    /\b(ah\s+bon\s*[.!]|évidemment\s*[.!]|comme\s+par\s+hasard|very\s+funny)\b/i.test(t) ||
    (/(\bbien\s+sûr\b|\bbien\s+sur\b)/i.test(t) && frustrationWithAgent);

  const satisfaction =
    /\b(merci\s+beaucoup|merci\s+bcp|nickel|parfait\s+pour\s+moi|ça\s+me\s+convient|super\s+merci|thanks\s+so\s+much|that\s+works)\b/i.test(
      t,
    );

  const buyingSignal =
    /\b(je\s+prends|je\s+commande|je\s+veux\s+l['’']?acheter|je\s+r[eè]gle|c['’']?est\s+combien\s+je\s+valide|je\s+paie|i['’']?ll\s+take\s+it|i\s+want\s+to\s+buy)\b/i.test(
      t,
    );

  return { frustrationWithAgent, confusion, sarcasmLikely, satisfaction, buyingSignal };
}
