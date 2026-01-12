import { GoogleGenerativeAI } from "@google/generative-ai";
import { QuizQuestion, QuizMatrix, QuizSpecification, SpecificationItem } from '../types';

// Hàm phân tích JSON từ phản hồi của AI
const parseJsonResponse = <T>(jsonText: string): T => {
  try {
    // Loại bỏ các ký tự Markdown nếu AI tự ý thêm vào
    const cleanJson = jsonText.replace(/```json|```/g, '').trim();
    return JSON.parse(cleanJson) as T;
  } catch (error) {
    console.error("Lỗi khi phân tích JSON:", jsonText, error);
    throw new Error("Phản hồi từ AI không phải là định dạng JSON hợp lệ.");
  }
};

// 1. Tạo bảng đặc tả
export const generateSpecification = async (matrix: QuizMatrix, selectedClass: string, selectedSubject: string): Promise<QuizSpecification> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key chưa được cấu hình. Vui lòng kết nối API.");
  
  const genAI = new GoogleGenerativeAI(apiKey);
  // Sử dụng gemini-1.5-flash để có hạn mức (quota) cao và ổn định
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const matrixString = JSON.stringify(matrix, null, 2);
  const prompt = `
    Bạn là chuyên gia khảo thí. Hãy chuyển ma trận sau thành bảng đặc tả chi tiết cho môn ${selectedSubject} lớp ${selectedClass}:
    ${matrixString}

    YÊU CẦU:
    1. LaTeX cho ký hiệu toán ($x, y, \pi$,...).
    2. Trả về một mảng JSON các đối tượng SpecificationItem.
    3. Giữ nguyên các nội dung kiến thức từ ma trận.
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return parseJsonResponse<SpecificationItem[]>(response.text());
  } catch (error) {
    console.error("Lỗi khi tạo bảng đặc tả:", error);
    throw error;
  }
};

// 2. Tạo đề từ đặc tả
export const generateQuizFromSpec = async (specification: QuizSpecification, selectedClass: string, selectedSubject: string): Promise<QuizQuestion[]> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key chưa được cấu hình.");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  
  const specString = JSON.stringify(specification, null, 2);
  const prompt = `
    Soạn đề kiểm tra ${selectedSubject} lớp ${selectedClass} theo đặc tả:
    ${specString}

    QUY TẮC:
    1. Lời giải chi tiết trong 'huongDanChamDiem'.
    2. LaTeX chuẩn ($ cho inline, $$ cho block).
    3. Nếu có hình vẽ minh họa, cung cấp mã JS vẽ Canvas vào 'drawingCode'.
    4. Trả về mảng JSON QuizQuestion.
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const qs = parseJsonResponse<QuizQuestion[]>(response.text());
    return qs.map(q => ({ ...q, id: q.id || Math.random().toString(36).substr(2, 9) }));
  } catch (error) {
    console.error("Lỗi khi tạo đề:", error);
    throw error;
  }
};

// 3. Tạo đề tương tự từ file/văn bản
export const generateSimilarQuizFromFile = async (content: { data?: string, mimeType?: string, text?: string }): Promise<QuizQuestion[]> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key chưa được cấu hình.");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  
  const promptText = "Dựa trên nội dung đề gốc, hãy tạo bộ đề MỚI gồm 10 câu hỏi tương tự về độ khó và chủ đề. Trả về mảng JSON QuizQuestion.";

  try {
    const contents: any[] = [];
    if (content.data && content.mimeType) {
      contents.push({ inlineData: { data: content.data, mimeType: content.mimeType } });
    } else if (content.text) {
      contents.push({ text: `Đề gốc: \n${content.text}` });
    }
    contents.push({ text: promptText });

    const result = await model.generateContent(contents);
    const response = await result.response;
    const qs = parseJsonResponse<QuizQuestion[]>(response.text());
    return qs.map(q => ({ ...q, id: q.id || Math.random().toString(36).substr(2, 9) }));
  } catch (error) {
    console.error("Lỗi khi tạo đề tương tự:", error);
    throw error;
  }
};

// 4. Làm mới một câu hỏi duy nhất
export const regenerateSingleQuestion = async (oldQuestion: QuizQuestion, selectedClass: string, selectedSubject: string): Promise<QuizQuestion> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key chưa được cấu hình.");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const prompt = `Tạo 1 câu hỏi ${selectedSubject} ${selectedClass} mới khác với câu: "${oldQuestion.cauHoi}" nhưng cùng chủ đề ${oldQuestion.metadata?.chuDe} và mức độ ${oldQuestion.metadata?.mucDo}. Trả về JSON duy nhất.`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const newQ = parseJsonResponse<QuizQuestion>(response.text());
    return { ...newQ, id: oldQuestion.id, metadata: oldQuestion.metadata };
  } catch (error) {
    console.error("Lỗi khi tạo lại câu hỏi:", error);
    throw error;
  }
};
