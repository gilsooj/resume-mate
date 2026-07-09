import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Lazy-loaded Gemini Client
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is required");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// API endpoint for resume generation
app.post("/api/generate", async (req, res) => {
  try {
    const { jobTitle, strengths, experience } = req.body;

    if (!jobTitle || !experience) {
      return res.status(400).json({ error: "직무명과 경험은 필수 입력 항목입니다." });
    }

    const ai = getGeminiClient();

    const systemInstruction = `
당신은 10년 경력의 베테랑 IT 채용 컨설턴트입니다.
사용자가 입력한 [직무명], [강점], [경험]을 바탕으로 고품질의 자기소개서를 생성하십시오.

작성 가이드라인 및 제약사항:
1. [역할]: 10년 경력 IT 채용 컨설턴트
2. [답변 스타일]: 실제 사람이 쓴 것처럼 솔직하면서도 신뢰감을 주는 정직하고 자신있는 톤으로 작성하십시오.
3. [구조]: 자기소개서는 반드시 '서론 + 경험 + 강점 + 마무리' 구조로 균형있게 구성되어야 합니다.
4. [분량]: 본문 전체 글자수는 공백 포함 500자 이내로 간결하고 임팩트 있게 작성하십시오. (paragraphs 안의 모든 문단 텍스트 총합이 500자 이내여야 함)
5. [범위]: 철저히 자기소개서(자소서) 관련 내용으로만 답변하십시오. 다른 딴소리나 불필요한 시스템 메시지는 일절 포함하지 마십시오.
6. [제약조건]: 절대로 허위 경력이나 사실과 다른 이력을 거짓으로 지어내지 마십시오. 사용자가 제공한 실제 직무와 경험에 근거하여 작성해야 합니다.

반드시 다음 JSON 형식에 맞춰 응답하여 주십시오. 한글 인코딩이 깨지지 않도록 유의하십시오.
`;

    const prompt = `
[사용자 입력 정보]
- 직무명: ${jobTitle}
- 강점: ${strengths || "지정되지 않음"}
- 경험: ${experience}

이 정보를 바탕으로 고품질의 자기소개서를 생성해 주세요.
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: {
              type: Type.STRING,
              description: "자기소개서의 소제목 (예: '데이터로 증명하는 퍼포먼스 마케터')",
            },
            subtitle: {
              type: Type.STRING,
              description: "지원 분야 및 성격의 요약 (예: '[지원동기 및 포부: 디지털 마케팅 직무]')",
            },
            paragraphs: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "자기소개서 본문 문단들의 배열 (최소 3개 문단)",
            },
            recommendation: {
              type: Type.STRING,
              description: "이 자기소개서의 강점 설명과 면접 또는 서류 제출 시 유용한 커리어 컨설턴트로서의 조언 및 추천사항",
            }
          },
          required: ["title", "subtitle", "paragraphs", "recommendation"],
        }
      }
    });

    const resultText = response.text;
    if (!resultText) {
      throw new Error("Gemini가 유효한 텍스트를 반환하지 않았습니다.");
    }

    const data = JSON.parse(resultText);
    res.json(data);
  } catch (error: any) {
    console.error("Error generating resume:", error);
    res.status(500).json({ error: error?.message || "자기소개서 생성 중 오류가 발생했습니다." });
  }
});

// API endpoint for tools - Keywords recommendation
app.post("/api/tools/keywords", async (req, res) => {
  try {
    const { jobTitle } = req.body;
    if (!jobTitle) {
      return res.status(400).json({ error: "직무명을 입력해주세요." });
    }

    const ai = getGeminiClient();
    const systemInstruction = `
당신은 취업 컨설턴트입니다. 사용자가 입력한 [직무명]에 가장 적합하고 면접관에게 매력적으로 어필할 수 있는 핵심 역량 키워드 5개와 각 키워드의 추천 이유, 그리고 활용 예시 문장을 작성해 주세요.
반드시 다음 JSON 형식에 맞추어 응답하십시오.
`;

    const prompt = `직무명: ${jobTitle}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            keywords: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  tag: { type: Type.STRING, description: "키워드 태그 (예: '#데이터분석')" },
                  reason: { type: Type.STRING, description: "이 키워드가 중요한 이유" },
                  example: { type: Type.STRING, description: "자기소개서에 활용할 수 있는 추천 예시 문장" }
                },
                required: ["tag", "reason", "example"]
              }
            }
          },
          required: ["keywords"]
        }
      }
    });

    const data = JSON.parse(response.text || "{}");
    res.json(data);
  } catch (error: any) {
    console.error("Error in keyword tool:", error);
    res.status(500).json({ error: error?.message || "키워드 생성 중 오류가 발생했습니다." });
  }
});

// API endpoint for tools - Interview questions
app.post("/api/tools/interview", async (req, res) => {
  try {
    const { jobTitle, experience } = req.body;
    if (!jobTitle || !experience) {
      return res.status(400).json({ error: "직무명과 경험을 입력해주세요." });
    }

    const ai = getGeminiClient();
    const systemInstruction = `
당신은 대기업 인사담당자입니다. 사용자의 [직무명]과 [경험] 내용을 바탕으로, 실제 면접에서 나올 수 있는 날카로운 예상 질문 3가지와 각 질문에 대한 합격 답변 팁(의도 파악 및 답변 방향)을 구성해 주세요.
반드시 다음 JSON 형식에 맞추어 응답하십시오.
`;

    const prompt = `직무명: ${jobTitle}\n경험: ${experience}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            questions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  question: { type: Type.STRING, description: "예상 면접 질문" },
                  intent: { type: Type.STRING, description: "인사담당자의 질문 의도" },
                  tip: { type: Type.STRING, description: "효과적인 답변 팁 및 가이드" }
                },
                required: ["question", "intent", "tip"]
              }
            }
          },
          required: ["questions"]
        }
      }
    });

    const data = JSON.parse(response.text || "{}");
    res.json(data);
  } catch (error: any) {
    console.error("Error in interview tool:", error);
    res.status(500).json({ error: error?.message || "면접 질문 생성 중 오류가 발생했습니다." });
  }
});

// Serve frontend build static files in production or set up Vite Dev Server in development
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
