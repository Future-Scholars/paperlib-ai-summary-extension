import GPT3Tokenizer from "@/utils/openai/gpt3-tokenizer/index";
import { readFileSync } from "fs";
import { PLAPI } from "paperlib-api/api";
import { PaperEntity } from "paperlib-api/model";
import { urlUtils } from "paperlib-api/utils";

import { IGeminiResponse, IOpenAIResponse } from "@/response";
import pdfworker from "@/utils/pdfjs/worker";

async function cmapProvider(name) {
  let buf = readFileSync(__dirname + "/cmaps/" + name + ".bcmap");
  return {
    compressionType: 1,
    cMapData: buf,
  };
}

let fontCache = {};
async function standardFontProvider(filename) {
  if (fontCache[filename]) {
    return fontCache[filename];
  }
  let data = readFileSync(__dirname + "/standard_fonts/" + filename);
  fontCache[filename] = data;
  return data;
}

export const OPENAIModels = {
  "gpt-3.5-turbo": 4096,
  "gpt-3.5-turbo-16k": 16385,
  "gpt-3.5-turbo-1106": 16385,
  "gpt-4": 8192,
  "gpt-4-32k": 32768,
  "gpt-4-1106-preview": 128000,
};

export class SummaryService {
  async getPDFText(fileURL: string, pageNum: number = 5) {
    try {
      const buf = readFileSync(urlUtils.eraseProtocol(fileURL));

      const data = await pdfworker.getFulltext(
        buf,
        "",
        pageNum,
        cmapProvider,
        standardFontProvider,
      );

      return data.text || "";
    } catch (e) {
      PLAPI.logService.error(
        "Failed to get PDF text.",
        e as Error,
        true,
        "AISummaryExt",
      );
      return "";
    }
  }

  async summarize(
    paperEntity: PaperEntity,
    pageNum: number = 5,
    prompt: string = "Summary this paper in 3-4 sentences:\n\n",
    model: string = "gemini-pro",
    apiKey: string = "",
  ) {
    const fileURL = await PLAPI.fileService.access(paperEntity.mainURL, true);

    const text = await this.getPDFText(fileURL, pageNum);

    let summary = "";
    if (model === "gemini-pro") {
      summary = await this.requestGeminiPro(text, prompt, apiKey);
    } else if (OPENAIModels.hasOwnProperty(model)) {
      summary = await this.requestGPT(text, prompt, apiKey, model);
    } else {
      PLAPI.logService.warn("Unknown model.", model, true, "AISummaryExt");
    }

    if (summary === "") {
      PLAPI.logService.warn("Summary is empty.", "", true, "AISummaryExt");
    }

    return summary;
  }

  private async requestGeminiPro(text: string, prompt: string, apiKey: string) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`;
      const content = {
        contents: [
          {
            parts: [
              {
                text: this._minimize(prompt + text),
              },
            ],
          },
        ],
      };

      const response = (await PLAPI.networkTool.post(
        url,
        content,
        {
          "Content-Type": "application/json",
        },
        0,
        300000,
        false,
        // @ts-ignore
        true,
      )) as any;

      const summary = (response.body as IGeminiResponse).candidates[0].content
        .parts[0].text;

      return summary;
    } catch (e) {
      PLAPI.logService.error(
        "Failed to request Gemini Pro.",
        e as Error,
        true,
        "AISummaryExt",
      );
      return "";
    }
  }

  private async requestGPT(
    text: string,
    prompt: string,
    apiKey: string,
    model: string,
  ) {
    try {
      const max_tokens = OPENAIModels[model];

      let msg = this._limitTokens(this._minimize(prompt + text), max_tokens);

      const url = `https://api.openai.com/v1/chat/completions`;
      const content = {
        model: model,
        messages: [
          {
            role: "system",
            content:
              "You are a academic paper explainer, skilled in explaining content of a paper.",
          },
          {
            role: "user",
            content: msg,
          },
        ],
      };

      const response = (await PLAPI.networkTool.post(
        url,
        content,
        {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        0,
        300000,
        false,
        // @ts-ignore
        true,
      )) as any;

      const summary = (response.body as IOpenAIResponse).choices[0].message
        .content;

      return summary;
    } catch (e) {
      PLAPI.logService.error(
        "Failed to request OPENAI GPT.",
        e as Error,
        true,
        "AISummaryExt",
      );
      return "";
    }
  }

  private _minimize(text: string) {
    // Remove all the new lines
    text = text.replace(/(\r\n|\n|\r)/gm, "");
    // Remove all the multiple spaces
    text = text.replace(/ +(?= )/g, "");
    // Remove all the tabs
    text = text.replace(/\t/g, "");
    // Remove all the spaces at the beginning
    text = text.replace(/^ /, "");
    // Remove all the spaces at the end
    text = text.replace(/ $/, "");

    return text;
  }

  private _limitTokens(text: string, max_tokens: number) {
    const tokens = new GPT3Tokenizer({ type: "gpt3" }).encode(text);
    const tokenCount = tokens.bpe.length;
    if ((tokenCount as number) < max_tokens) {
      return text;
    } else {
      const textList = text.split(" ");
      const ratio = (max_tokens / (tokenCount as number)) * 0.9;
      return textList.slice(0, Math.floor(textList.length * ratio)).join(" ");
    }
  }
}
