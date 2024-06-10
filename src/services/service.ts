import { LLMsAPI } from "@future-scholars/llms-api-service";
import { readFileSync } from "fs";
import { PLAPI, PLExtAPI } from "paperlib-api/api";
import { PaperEntity } from "paperlib-api/model";
import { urlUtils } from "paperlib-api/utils";

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

export class AISummaryExtService {
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
    prompt: string,
    systemInstruction: string = "",
    model: string = "gemini-1.0-pro",
    apiKey: string = "",
    customAPIURL: string = "",
  ) {
    const fileURL = await PLAPI.fileService.access(paperEntity.mainURL, true);
    const text = await this.getPDFText(fileURL, pageNum);
    const query = prompt + text;

    const summary = await LLMsAPI.model(model)
      .setAPIKey(apiKey)
      .setAPIURL(customAPIURL)
      .setSystemInstruction(systemInstruction)
      .query(query, undefined, async (url: string, headers: Record<string, string>, body: any) => {
        const response = (await PLExtAPI.networkTool.post(
          url,
          body,
          headers,
          0,
          300000,
          false,
          true,
        )) as any;


        if (
          response.body instanceof String ||
          typeof response.body === "string"
        ) {
          return JSON.parse(response.body);
        } else {
          return response.body;
        }
      }, true);

    return summary;
  }

  async tag(
    paperEntity: PaperEntity,
    prompt: string,
    systemInstruction: string = "",
    model: string = "gemini-1.0-pro",
    apiKey: string = "",
    customAPIURL: string = "",
  ) {
    const fileURL = await PLAPI.fileService.access(paperEntity.mainURL, true);

    const text = await this.getPDFText(fileURL, 1);
    const query = prompt + text;

    let additionalArgs: any = undefined;
    if (LLMsAPI.modelServiceProvider(model) === "Gemini") {
      additionalArgs = {
        generationConfig: { responseMimeType: "application/json" },
      }
    } else if (LLMsAPI.modelServiceProvider(model) === "OpenAI" && (model === "gpt-3.5-turbo-1106" || model === "gpt-4-turbo" || model === "gpt-4o")) {
      additionalArgs = {
        response_format: { "type": "json_object" },
      }
    }

    let suggestedTagStr = await LLMsAPI.model(model)
      .setAPIKey(apiKey)
      .setAPIURL(customAPIURL)
      .setSystemInstruction(systemInstruction)
      .query(query, additionalArgs, async (url: string, headers: Record<string, string>, body: any) => {
        const response = (await PLExtAPI.networkTool.post(
          url,
          body,
          headers,
          0,
          300000,
          false,
          true,
        )) as any;


        if (
          response.body instanceof String ||
          typeof response.body === "string"
        ) {
          return JSON.parse(response.body);
        } else {
          return response.body;
        }
      });

    return suggestedTagStr;
  }

  async filter(
    paperEntities: PaperEntity[],
    prompt: string,
    systemInstruction: string = "",
    model: string = "gemini-1.0-pro",
    apiKey: string = "",
    customAPIURL: string = "",
  ) {
    const ids = []
    // Every 200 papers, we will send a request to the model
    for (let i = 0; i < paperEntities.length; i += 200) {
      const paperEntitiesSlice = paperEntities.slice(i, i + 200);

      let data: any[] = []

      for (const j in paperEntitiesSlice) {
        const paperEntity = paperEntitiesSlice[j];
        const paperrow = {
          id: j,
          title: paperEntity.title,
          authors: paperEntity.authors,
          year: paperEntity.pubTime,
          pubVenue: paperEntity.publication,
          tags: paperEntity.tags.map((tag) => tag.name).join("/"),
          folders: paperEntity.folders.map((folder) => folder.name).join("/")
        }
        data.push(paperrow);
      }

      const dataStr = JSON.stringify(data);

      const query = prompt + dataStr;

      let additionalArgs: any = undefined;

      if (LLMsAPI.modelServiceProvider(model) === "Gemini") {
        additionalArgs = {
          generationConfig: { responseMimeType: "application/json" },
        }
      } else if (LLMsAPI.modelServiceProvider(model) === "OpenAI" && (model === "gpt-3.5-turbo-1106" || model === "gpt-4-turbo" || model === "gpt-4o")) {
        additionalArgs = {
          response_format: { "type": "json_object" },
        }
      }

      let filteredCSVIds = await LLMsAPI.model(model)
        .setAPIKey(apiKey)
        .setAPIURL(customAPIURL)
        .setSystemInstruction(systemInstruction)
        .query(query, additionalArgs, async (url: string, headers: Record<string, string>, body: any) => {
          const response = (await PLExtAPI.networkTool.post(
            url,
            body,
            headers,
            0,
            300000,
            false,
            true,
          )) as any;

          if (
            response.body instanceof String ||
            typeof response.body === "string"
          ) {
            return JSON.parse(response.body);
          } else {
            return response.body;
          }
        }, true);

      try {
        const filteredIds = JSON.parse(filteredCSVIds).ids as [];
        ids.push(...filteredIds);
      } catch (e) {
        PLAPI.logService.error(
          "Failed to parse the response of the filter model.",
          e as Error,
          false,
          "AISummaryExt",
        );
      }
    }

    return ids
  }
}
