import { PLAPI, PLExtAPI, PLExtension, PLMainAPI } from "paperlib-api/api";
import { PaperEntity } from "paperlib-api/model";

import {
  AIService,
  OPENAIModels,
  PerplexityModels,
} from "@/services/ai-service";

class PaperlibAISummaryExtension extends PLExtension {
  disposeCallbacks: (() => void)[];

  private readonly _aiService: AIService;

  constructor() {
    super({
      id: "@future-scholars/paperlib-ai-summary-extension",
      defaultPreference: {
        markdown: {
          type: "boolean",
          name: "Markdown Style",
          description: "Use markdown style for the summary note.",
          value: true,
          order: 0,
        },
        "ai-model": {
          type: "options",
          name: "LLM Model",
          description: "The LLM model to use.",
          options: {
            "gemini-pro": "Gemini Pro 1.0",
            "gemini-1.5-pro-latest": "Gemini Pro 1.5",
            "gpt-3.5-turbo": "GPT-3.5 Turbo",
            "gpt-3.5-turbo-16k": "GPT-3.5 Turbo 16K",
            "gpt-3.5-turbo-1106": "GPT-3.5 Turbo 1106",
            "gpt-4": "GPT-4",
            "gpt-4-32k": "GPT-4 32K",
            "gpt-4-1106-preview": "GPT-4 1106 Preview",
            "codellama-70b-instruct": "Perplexity codellama-70b",
            "mistral-7b-instruct": "Perplexity mistral-7b",
            "mixtral-8x7b-instruct": "Perplexity mistral-8x7b",
            "sonar-small-chat": "Perplexity sonar-small-chat",
            "sonar-medium-chat": "Perplexity sonar-medium-chat",
          },
          value: "gemini-pro",
          order: 1,
        },
        "gemini-api-key": {
          type: "string",
          name: "Gemini API Key",
          description: "The API key for Gemini.",
          value: "",
          order: 2,
        },
        "openai-api-key": {
          type: "string",
          name: "OpenAI API Key",
          description: "The API key for OpenAI.",
          value: "",
          order: 2,
        },
        "perplexity-api-key": {
          type: "string",
          name: "Perplexity API Key",
          description: "The API key for Perplexity.",
          value: "",
          order: 2,
        },
        prompt: {
          type: "string",
          name: "Prompt",
          description: "Prompt for summarizing.",
          value: "Summary this paper in 3-4 sentences:\n\n",
          order: 3,
        },
        pageNum: {
          type: "string",
          name: "Page Number",
          description: "The number of pages to provide.",
          value: 5,
          order: 4,
        },
        customAPIURL: {
          type: "string",
          name: "Custom API URL",
          description: "The proxied API URL.",
          value: "",
          order: 5,
        },
      },
    });

    this.disposeCallbacks = [];
    this._aiService = new AIService();
  }

  async initialize() {
    await PLExtAPI.extensionPreferenceService.register(
      this.id,
      this.defaultPreference,
    );

    // ============
    // Summary Command
    this.disposeCallbacks.push(
      PLAPI.commandService.on(
        "@future-scholars/symmarize_selected_paper" as any,
        (value) => {
          this.summarize();
        },
      ),
    );

    this.disposeCallbacks.push(
      PLAPI.commandService.registerExternel({
        id: `summarize`,
        description: "Summarize the current selected paper.",
        event: "@future-scholars/symmarize_selected_paper",
      }),
    );

    this.disposeCallbacks.push(
      PLMainAPI.contextMenuService.on(
        "dataContextMenuFromExtensionsClicked",
        (value) => {
          const {extID, itemID} = value.value
          if (extID === this.id && itemID === "summarize") {
            this.summarize();
          }
        },
      ),
    );

    // ============
    // AITag Command
    this.disposeCallbacks.push(
      PLAPI.commandService.on(
        "@future-scholars/aitag_selected_paper" as any,
        (value) => {
          this.aitag();
        },
      ),
    );

    this.disposeCallbacks.push(
      PLAPI.commandService.registerExternel({
        id: `tagit`,
        description: "Use AI to tag the selected papers.",
        event: "@future-scholars/aitag_selected_paper",
      }),
    );

    this.disposeCallbacks.push(
      PLMainAPI.contextMenuService.on(
        "dataContextMenuFromExtensionsClicked",
        (value) => {
          const {extID, itemID} = value.value

          if (extID === this.id && itemID === "tagit") {
            this.aitag();
          }
        },
      ),
    );

    // ============
    // Context Menu

    PLMainAPI.contextMenuService.registerContextMenu(this.id, [
      {
        id: "summarize",
        label: "AISummaryExt - summarize",
      },
      {
        id: "tagit",
        label: "AISummaryExt - tag it",
      },
    ]);
  }

  async dispose() {
    PLExtAPI.extensionPreferenceService.unregister(this.id);
    PLMainAPI.contextMenuService.unregisterContextMenu(this.id);

    this.disposeCallbacks.forEach((callback) => callback());
  }

  async summarize() {
    PLAPI.logService.info(
      "Summarize the selected paper.",
      "",
      false,
      "AISummaryExt",
    );

    // Show spinner.
    await PLAPI.uiStateService.setState({
      "processingState.general":
        parseInt(
          (await PLAPI.uiStateService.getState(
            "processingState.general",
          )) as string,
        ) + 1,
    });

    try {
      const selectedPaperEntities = (await PLAPI.uiStateService.getState(
        "selectedPaperEntities",
      )) as PaperEntity[];

      if (selectedPaperEntities.length !== 1) {
        return;
      }

      const paperEntity = selectedPaperEntities[0];

      const pageNum = parseInt(
        (await PLExtAPI.extensionPreferenceService.get(
          this.id,
          "pageNum",
        )) as string,
      );
      let prompt = (await PLExtAPI.extensionPreferenceService.get(
        this.id,
        "prompt",
      )) as string;
      const model = (await PLExtAPI.extensionPreferenceService.get(
        this.id,
        "ai-model",
      )) as string;
      let apiKey = "";
      const customAPIURL = (await PLExtAPI.extensionPreferenceService.get(
        this.id,
        "customAPIURL",
      )) as string;
      if (model === "gemini-pro") {
        apiKey = (await PLExtAPI.extensionPreferenceService.get(
          this.id,
          "gemini-api-key",
        )) as string;
      } else if (OPENAIModels.hasOwnProperty(model)) {
        apiKey = (await PLExtAPI.extensionPreferenceService.get(
          this.id,
          "openai-api-key",
        )) as string;
      } else if (PerplexityModels.hasOwnProperty(model)) {
        apiKey = (await PLExtAPI.extensionPreferenceService.get(
          this.id,
          "perplexity-api-key",
        )) as string;
      }

      const useMarkdown = await PLExtAPI.extensionPreferenceService.get(
        this.id,
        "markdown",
      );

      prompt = prompt || "Summary this paper in 3-4 sentences:\n\n";
      if (useMarkdown) {
        prompt = "Output please use markdown style.\n" + prompt;
      }
      let summary = await this._aiService.summarize(
        paperEntity,
        pageNum,
        prompt,
        model,
        apiKey,
        customAPIURL,
      );

      if (summary) {
        if (useMarkdown) {
          if (paperEntity.note === "") {
            summary = "<md>\n## AI Summary \n\n" + summary;
          } else {
            if (paperEntity.note.startsWith("<md>")) {
              summary = "\n\n## AI Summary \n\n" + summary;
            } else {
              paperEntity.note =
                "<md>\n" +
                paperEntity.note +
                "\n\n## AI Summary \n\n" +
                summary;
            }
          }
        } else {
          if (paperEntity.note === "") {
            summary = "AI Summary: " + summary;
          } else {
            summary = "\n\nAI Summary: " + summary;
          }
        }
        paperEntity.note = paperEntity.note + summary;
        await PLAPI.paperService.update([paperEntity], false, true);
      }
    } catch (error) {
      PLAPI.logService.error(
        "Failed to summarize the selected paper.",
        error as Error,
        false,
        "AISummaryExt",
      );
    } finally {
      await PLAPI.uiStateService.setState({
        "processingState.general":
          parseInt(
            (await PLAPI.uiStateService.getState(
              "processingState.general",
            )) as string,
          ) - 1,
      });
    }
  }

  async aitag() {
    PLAPI.logService.info(
      "AITag the selected paper.",
      "",
      false,
      "AISummaryExt",
    );

    // Show spinner.
    await PLAPI.uiStateService.setState({
      "processingState.general":
        parseInt(
          (await PLAPI.uiStateService.getState(
            "processingState.general",
          )) as string,
        ) + 1,
    });

    try {
      const selectedPaperEntities = (await PLAPI.uiStateService.getState(
        "selectedPaperEntities",
      )) as PaperEntity[];

      if (selectedPaperEntities.length === 0) {
        return;
      }

      const tags = await PLAPI.categorizerService.load(
        "PaperTag" as any,
        "count",
        "desc",
      );
      const tagList = `[${tags
        .filter((v) => v.name !== "Tags")
        .map((tag) => tag.name)
        .join(", ")}]`;

      for (const paperEntity of selectedPaperEntities) {
        if (paperEntity.tags.length !== 0) {
          PLAPI.logService.warn(
            "The paper already has tags.",
            paperEntity.title,
            true,
            "AISummaryExt",
          );
          continue;
        }

        let prompt = (await PLExtAPI.extensionPreferenceService.get(
          this.id,
          "prompt",
        )) as string;
        const model = (await PLExtAPI.extensionPreferenceService.get(
          this.id,
          "ai-model",
        )) as string;
        let apiKey = "";
        const customAPIURL = (await PLExtAPI.extensionPreferenceService.get(
          this.id,
          "customAPIURL",
        )) as string;
        if (model === "gemini-pro") {
          apiKey = (await PLExtAPI.extensionPreferenceService.get(
            this.id,
            "gemini-api-key",
          )) as string;
        } else if (OPENAIModels.hasOwnProperty(model)) {
          apiKey = (await PLExtAPI.extensionPreferenceService.get(
            this.id,
            "openai-api-key",
          )) as string;
        } else if (PerplexityModels.hasOwnProperty(model)) {
          apiKey = (await PLExtAPI.extensionPreferenceService.get(
            this.id,
            "perplexity-api-key",
          )) as string;
        }

        prompt = `Please help me to choose some related tags for the paper titled ${paperEntity.title} from this tag list: ${tagList}. Please don't create new tags. If none is related, just return an empty array. Better less than more. Please just give me a JSON stringified string like {"suggested": ["tag1"]} without any other content, which can be directly parsed by JSON.parse(). The first page content can be used as a reference: ".`;

        let suggestedTagStr = await this._aiService.aitag(
          paperEntity,
          prompt,
          model,
          apiKey,
          customAPIURL,
        );
        if (suggestedTagStr) {
          try {
            const jsonStr = suggestedTagStr.match(/\{.*\}/gm)![0];

            const { suggested } = JSON.parse(jsonStr);
            const suggestedTags = tags.filter((tag) =>
              suggested.includes(tag.name),
            );
            paperEntity.tags.push(...suggestedTags);

            await PLAPI.paperService.update([paperEntity], false, true);
          } catch (error) {
            PLAPI.logService.error(
              "Failed to parse the suggested tags.",
              suggestedTagStr,
              true,
              "AISummaryExt",
            );
            PLAPI.logService.error(
              "Failed to tag the selected paper.",
              error as Error,
              false,
              "AISummaryExt",
            );
          }
        }
      }
    } catch (error) {
      PLAPI.logService.error(
        "Failed to tag the selected paper.",
        error as Error,
        false,
        "AISummaryExt",
      );
    } finally {
      await PLAPI.uiStateService.setState({
        "processingState.general":
          parseInt(
            (await PLAPI.uiStateService.getState(
              "processingState.general",
            )) as string,
          ) - 1,
      });
    }
  }
}

async function initialize() {
  const extension = new PaperlibAISummaryExtension();
  await extension.initialize();

  return extension;
}

export { initialize };
