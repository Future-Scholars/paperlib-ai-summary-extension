import { LLMsAPI } from "@future-scholars/llms-api-service";
import { PLAPI, PLExtAPI, PLExtension, PLMainAPI } from "paperlib-api/api";
import { PaperEntity } from "paperlib-api/model";

import { AISummaryExtService } from "@/services/service";

class PaperlibAISummaryExtension extends PLExtension {
  disposeCallbacks: (() => void)[];

  private readonly _service: AISummaryExtService;

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
            "deepseek-chat": "DeepSeek v3",
            "glm-3-turbo": "ChatGLM 3 Turbo",
            "glm-4": "ChatGLM 4",
            "glm-4-air": "ChatGLM 4 Air",
            "glm-4-flash": "ChatGLM 4 Flash",
            "glm-4v": "ChatGLM 4v",
            "glm-4-0520": "ChatGLM 4 0520",
            "gemini-1.0-pro": "Gemini 1.0 Pro",
            "gemini-1.5-pro-latest": "Gemini 1.5 Pro",
            "gemini-1.5-flash-latest": "Gemini 1.5 Flash",
            "gemini-2.0-flash-exp": "Gemini 2.0 Flash",
            "gpt-3.5-turbo": "GPT-3.5 Turbo",
            "gpt-3.5-turbo-16k": "GPT-3.5 Turbo 16K",
            "gpt-3.5-turbo-1106": "GPT-3.5 Turbo 1106",
            "gpt-4": "GPT-4",
            "gpt-4-32k": "GPT-4 32K",
            "gpt-4-1106-preview": "GPT-4 1106 Preview",
            "gpt-4-turbo": "GPT-4 Turbo",
            "gpt-4o": "GPT-4o",
            "gpt-4o-mini": "GPT-4o Mini",
            "codellama-70b-instruct": "Perplexity codellama-70b",
            "mistral-7b-instruct": "Perplexity mistral-7b",
            "mixtral-8x7b-instruct": "Perplexity mistral-8x7b",
            "sonar-small-chat": "Perplexity sonar-small-chat",
            "sonar-medium-chat": "Perplexity sonar-medium-chat",
          },
          value: "gpt-4o-mini",
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
        "zhipu-api-key": {
          type: "string",
          name: "Zhipu ChatGLM API Key",
          description: "The API key for ChatGLMs.",
          value: "",
          order: 2,
        },
        "deepseek-api-key": {
          type: "string",
          name: "Deepseek API Key",
          description: "The API key for Deepseek.",
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
        customAPIKey: {
          type: "string",
          name: "Custom API Key",
          description: "This should be used if the custom model code is not empty.",
          value: "",
          order: 5,
        },
        customModelCode: {
          type: "string",
          name: "Custom Model Code",
          description:
            "The custom model code. If not empty, use the custom model. Otherwise, use the selected model.",
          value: "",
          order: 6,
        },
      },
    });

    this.disposeCallbacks = [];
    this._service = new AISummaryExtService();
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
        description: "Summarize the current selected paper with LLMs.",
        event: "@future-scholars/symmarize_selected_paper",
      }),
    );

    this.disposeCallbacks.push(
      PLMainAPI.contextMenuService.on(
        "dataContextMenuFromExtensionsClicked",
        (value) => {
          const { extID, itemID } = value.value;
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
          this.tag();
        },
      ),
    );

    this.disposeCallbacks.push(
      PLAPI.commandService.registerExternel({
        id: `tagit`,
        description: "Use LLMs to tag the selected papers.",
        event: "@future-scholars/aitag_selected_paper",
      }),
    );

    this.disposeCallbacks.push(
      PLMainAPI.contextMenuService.on(
        "dataContextMenuFromExtensionsClicked",
        (value) => {
          const { extID, itemID } = value.value;

          if (extID === this.id && itemID === "tagit") {
            this.tag();
          }
        },
      ),
    );

    // =================
    // Filter Command
    this.disposeCallbacks.push(
      PLAPI.commandService.on(
        "@future-scholars/filter_library" as any,
        (value) => {
          this.filter(value.value);
        },
      ),
    );

    this.disposeCallbacks.push(
      PLAPI.commandService.registerExternel({
        id: `semanfilter`,
        description:
          "Semantically filter the library with natural language powered by LLMs.",
        event: "@future-scholars/filter_library",
      }),
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

  async getAPIKey(model: string) {
    const customAPIKey = (await PLExtAPI.extensionPreferenceService.get(
      this.id,
      "customAPIKey",
    )) as string;

    if (customAPIKey) {
      return customAPIKey;
    }

    let apiKey = "";
    const modelServiceProvider = LLMsAPI.modelServiceProvider(model);
    if (modelServiceProvider === "Gemini") {
      apiKey = (await PLExtAPI.extensionPreferenceService.get(
        this.id,
        "gemini-api-key",
      )) as string;
    } else if (modelServiceProvider === "OpenAI") {
      apiKey = (await PLExtAPI.extensionPreferenceService.get(
        this.id,
        "openai-api-key",
      )) as string;
    } else if (modelServiceProvider === "Perplexity") {
      apiKey = (await PLExtAPI.extensionPreferenceService.get(
        this.id,
        "perplexity-api-key",
      )) as string;
    } else if (modelServiceProvider === "Zhipu") {
      apiKey = (await PLExtAPI.extensionPreferenceService.get(
        this.id,
        "zhipu-api-key",
      )) as string;
    } else if (modelServiceProvider === "Deepseek") {
      apiKey = (await PLExtAPI.extensionPreferenceService.get(
        this.id,
        "deepseek-api-key",
      )) as string;
    } else {
      apiKey = (await PLExtAPI.extensionPreferenceService.get(
        this.id,
        "openai-api-key",
      )) as string;
    }

    return apiKey;
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
      prompt = prompt || "Summary this paper in 3-4 sentences:\n\n";

      let model = (await PLExtAPI.extensionPreferenceService.get(
        this.id,
        "ai-model",
      )) as string;

      const customAPIURL = (await PLExtAPI.extensionPreferenceService.get(
        this.id,
        "customAPIURL",
      )) as string;

      const customModelCode = (await PLExtAPI.extensionPreferenceService.get(
        this.id,
        "customModelCode",
      )) as string;

      if (customModelCode) {
        model = customModelCode;
      }

      const apiKey = await this.getAPIKey(model);

      const useMarkdown = await PLExtAPI.extensionPreferenceService.get(
        this.id,
        "markdown",
      );
      let systemInstruction =
        "You are an AI assistant for summarizing academic publications.\n";
      if (useMarkdown) {
        systemInstruction =
          "Don't start with a title etc. Please format the output in markdown style.\n";
      }

      let summary = await this._service.summarize(
        paperEntity,
        pageNum,
        prompt,
        systemInstruction,
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
      } else {
        PLAPI.logService.warn("Summary is empty.", "", true, "AISummaryExt");
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

  async tag() {
    PLAPI.logService.info(
      "Tag the selected paper with AI.",
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

        let model = (await PLExtAPI.extensionPreferenceService.get(
          this.id,
          "ai-model",
        )) as string;

        const customAPIURL = (await PLExtAPI.extensionPreferenceService.get(
          this.id,
          "customAPIURL",
        )) as string;

        const customModelCode = (await PLExtAPI.extensionPreferenceService.get(
          this.id,
          "customModelCode",
        )) as string;

        if (customModelCode) {
          model = customModelCode;
        }

        const prompt = `Please help me to choose some highly-related tags for the paper titled ${paperEntity.title} from this tag list: ${tagList}. The first page content can be used as a reference: ".`;
        const systemInstruction = `You are an AI assistant for tagging academic publications.\n Please just give me a JSON stringified string like {"suggested": ["tag1"]} without any other content, which can be directly parsed by JSON.parse(). Please don't create new tags. If none is related, just return an empty array. Better less than more.`;

        const apiKey = await this.getAPIKey(model);

        let suggestedTagStr = await this._service.tag(
          paperEntity,
          prompt,
          systemInstruction,
          model,
          apiKey,
          customAPIURL,
        );
        if (suggestedTagStr) {
          try {
            const { suggested } = LLMsAPI.parseJSON(suggestedTagStr);
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
        } else {
          PLAPI.logService.warn(
            "Suggested tags is empty.",
            "",
            true,
            "AISummaryExt",
          );
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

  async filter(query: string) {
    PLAPI.logService.info(
      "Filter the library with AI.",
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
      const paperEntities = (await PLAPI.paperService.load(
        "",
        "addTime",
        "desc",
      )) as PaperEntity[];

      if (paperEntities.length === 0) {
        return;
      }

      let model = (await PLExtAPI.extensionPreferenceService.get(
        this.id,
        "ai-model",
      )) as string;

      const customAPIURL = (await PLExtAPI.extensionPreferenceService.get(
        this.id,
        "customAPIURL",
      )) as string;

      const customModelCode = (await PLExtAPI.extensionPreferenceService.get(
        this.id,
        "customModelCode",
      )) as string;

      if (customModelCode) {
        model = customModelCode;
      }

      const prompt = `\nAccording to the above paper list, please help me to filter the paper list according to my semantic query: '${query}'`;
      const systemInstruction =
        `You are an AI assistant for filtering academic publications according to users query.\n` +
        `Please filter the paper list according to the user's query and return the id list. \n` +
        `Please just give user a JSON stringified string for the id list like {"ids": [1, 3]} without any other content, which can be directly parsed by JSON.parse().`;

      const apiKey = await this.getAPIKey(model);

      let ids = await this._service.filter(
        paperEntities,
        prompt,
        systemInstruction,
        model,
        apiKey,
        customAPIURL,
      );

      if (ids.length > 0) {
        const filteredPaperEntities = ids.map(
          (id) => paperEntities[id],
        ) as PaperEntity[];

        const idsQuery = filteredPaperEntities
          .map((paperEntity) => `oid(${paperEntity.id})`)
          .join(", ");
        const filter = `_id IN { ${idsQuery} }`;

        await PLAPI.uiStateService.setState({
          querySentenceCommandbar: filter,
          selectedQuerySentenceIds: [""],
        });
      }
    } catch (error) {
      PLAPI.logService.error(
        "Failed to filter the library.",
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
