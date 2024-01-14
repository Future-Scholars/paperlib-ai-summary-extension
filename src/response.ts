export interface IGeminiResponse {
  candidates: [
    {
      content: {
        parts: [
          {
            text: string;
          },
        ];
      };
    },
  ];
}

export interface IOpenAIResponse {
  choices: [
    {
      message: {
        content: string;
      };
    },
  ];
}
