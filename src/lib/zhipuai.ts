/**
 * Toonflow 智谱AI供应商适配
 * @version 1.0
 * @description 支持文生图(CogView-4/GLM-Image)、图生视频(CogVideoX)、文本模型(GLM系列)
 * @author Corps-Cy
 *
 * API文档: https://docs.bigmodel.cn/cn/api/introduction
 * 端点: https://open.bigmodel.cn/api/paas/v4
 */

// ============================================================
// 类型定义（与vendor模板一致，无需修改）
// ============================================================

type VideoMode =
  | "singleImage"
  | "startEndRequired"
  | "endFrameOptional"
  | "startFrameOptional"
  | "text"
  | (`videoReference:${number}` | `imageReference:${number}` | `audioReference:${number}`)[];

interface TextModel {
  name: string;
  modelName: string;
  type: "text";
  think: boolean;
}

interface ImageModel {
  name: string;
  modelName: string;
  type: "image";
  mode: ("text" | "singleImage" | "multiReference")[];
  associationSkills?: string;
}

interface VideoModel {
  name: string;
  modelName: string;
  type: "video";
  mode: VideoMode[];
  associationSkills?: string;
  audio: "optional" | false | true;
  durationResolutionMap: { duration: number[]; resolution: string[] }[];
}

interface TTSModel {
  name: string;
  modelName: string;
  type: "tts";
  voices: { title: string; voice: string }[];
}

interface VendorConfig {
  id: string;
  version: string;
  name: string;
  author: string;
  description?: string;
  icon?: string;
  inputs: { key: string; label: string; type: "text" | "password" | "url"; required: boolean; placeholder?: string }[];
  inputValues: Record<string, string>;
  models: (TextModel | ImageModel | VideoModel | TTSModel)[];
}

type ReferenceList =
  | { type: "image"; sourceType: "base64"; base64: string }
  | { type: "audio"; sourceType: "base64"; base64: string }
  | { type: "video"; sourceType: "base64"; base64: string };

interface ImageConfig {
  prompt: string;
  referenceList?: Extract<ReferenceList, { type: "image" }>[];
  size: "1K" | "2K" | "4K";
  aspectRatio: `${number}:${number}`;
}

interface VideoConfig {
  duration: number;
  resolution: string;
  aspectRatio: "16:9" | "9:16";
  prompt: string;
  referenceList?: ReferenceList[];
  audio?: boolean;
  mode: VideoMode[];
}

interface TTSConfig {
  text: string;
  voice: string;
  speechRate: number;
  pitchRate: number;
  volume: number;
  referenceList?: Extract<ReferenceList, { type: "audio" }>[];
}

interface PollResult {
  completed: boolean;
  data?: string;
  error?: string;
}

declare const axios: any;
declare const logger: (msg: string) => void;
declare const urlToBase64: (url: string) => Promise<string>;
declare const pollTask: (fn: () => Promise<PollResult>, interval?: number, timeout?: number) => Promise<PollResult>;
declare const createZhipu: any;
declare const exports: {
  vendor: VendorConfig;
  textRequest: (m: TextModel, t: boolean, tl: 0 | 1 | 2 | 3) => any;
  imageRequest: (c: ImageConfig, m: ImageModel) => Promise<string>;
  videoRequest: (c: VideoConfig, m: VideoModel) => Promise<string>;
  ttsRequest: (c: TTSConfig, m: TTSModel) => Promise<string>;
  checkForUpdates?: () => Promise<{ hasUpdate: boolean; latestVersion: string; notice: string }>;
  updateVendor?: () => Promise<string>;
};

// ============================================================
// 供应商配置
// ============================================================

const vendor: VendorConfig = {
  id: "zhipuai",
  version: "1.0",
  name: "智谱AI",
  author: "Corps-Cy",
  description:
    "智谱AI开放平台适配，支持文本对话(GLM系列)、文生图(CogView-4/GLM-Image)、文生视频/图生视频(CogVideoX系列)\n\n[智谱AI开放平台](https://open.bigmodel.cn/)",
  inputs: [
    {
      key: "apiKey",
      label: "API密钥",
      type: "password",
      required: true,
      placeholder: "在 open.bigmodel.cn 获取",
    },
  ],
  inputValues: { apiKey: "" },
  models: [
    // ---- 文本模型 ----
    { name: "GLM-5", modelName: "glm-5", type: "text", think: true },
    { name: "GLM-5.1", modelName: "glm-5.1", type: "text", think: true },
    { name: "GLM-4-Plus", modelName: "glm-4-plus", type: "text", think: false },
    { name: "GLM-4-Flash", modelName: "glm-4-flash", type: "text", think: false },
    // ---- 图像模型 ----
    {
      name: "GLM-Image (旗舰)",
      modelName: "glm-image",
      type: "image",
      mode: ["text"],
    },
    {
      name: "CogView-4",
      modelName: "cogview-4-250304",
      type: "image",
      mode: ["text"],
    },
    {
      name: "CogView-3-Flash (免费)",
      modelName: "cogview-3-flash",
      type: "image",
      mode: ["text"],
    },
    // ---- 视频模型 ----
    {
      name: "CogVideoX-3",
      modelName: "cogvideox-3",
      type: "video",
      mode: ["text", "singleImage", "startEndRequired"],
      audio: "optional",
      durationResolutionMap: [
        { duration: [5, 10], resolution: ["720p", "1080p", "4k"] },
      ],
    },
    {
      name: "CogVideoX-2",
      modelName: "cogvideox-2",
      type: "video",
      mode: ["text", "singleImage"],
      audio: false,
      durationResolutionMap: [
        { duration: [5], resolution: ["720p", "1080p", "4k"] },
      ],
    },
    {
      name: "CogVideoX-Flash (免费)",
      modelName: "cogvideox-flash",
      type: "video",
      mode: ["text", "singleImage"],
      audio: false,
      durationResolutionMap: [
        { duration: [5], resolution: ["720p", "1080p", "4k"] },
      ],
    },
  ],
};

// ============================================================
// 辅助工具
// ============================================================

const API_BASE = "https://open.bigmodel.cn/api/paas/v4";

const getHeaders = () => {
  const apiKey = vendor.inputValues.apiKey.replace(/^Bearer\s+/i, "");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
};

/** 将 aspectRatio + size 映射为智谱的 size 参数 */
const mapImageSize = (aspectRatio: string, size: string): string => {
  // 智谱支持尺寸: 1280x1280, 1568x1056, 1056x1568, 1472x1088, 1088x1472, 1728x960, 960x1728
  // 以及 1024x1024, 768x1344, 864x1152, 1344x768, 1152x864, 1440x720, 720x1440
  const sizeMap: Record<string, string> = {
    "1K": "1024x1024",
    "2K": "1280x1280",
    "4K": "2048x1152",
  };
  const baseSize = sizeMap[size] || "1024x1024";

  // 根据 aspectRatio 调整
  switch (aspectRatio) {
    case "16:9":
      return size === "4K" ? "2048x1152" : "1344x768";
    case "9:16":
      return size === "4K" ? "1152x2048" : "768x1344";
    case "4:3":
      return "1472x1088";
    case "3:4":
      return "1088x1472";
    default:
      return baseSize;
  }
};

/** 将 resolution 映射为智谱的视频尺寸 */
const mapVideoSize = (aspectRatio: string, resolution: string): string => {
  const resHeight = resolution === "4k" ? "2160" : resolution === "1080p" ? "1080" : "720";
  if (aspectRatio === "9:16") {
    return `1080x${resHeight}`;
  }
  return `${resHeight === "2160" ? "3840" : resHeight === "1080" ? "1920" : "1280"}x${resHeight}`;
};

/** 判断 model 是否为 glm-image */
const isGlmImage = (modelName: string) => modelName === "glm-image";

// ============================================================
// 文本请求
// ============================================================

const textRequest = (model: TextModel, think: boolean, thinkLevel: 0 | 1 | 2 | 3) => {
  if (!vendor.inputValues.apiKey) throw new Error("缺少API Key");
  const apiKey = vendor.inputValues.apiKey.replace(/^Bearer\s+/i, "");
  return createZhipu({ apiKey }).chat(model.modelName);
};

// ============================================================
// 图像请求
// ============================================================

const imageRequest = async (config: ImageConfig, model: ImageModel): Promise<string> => {
  if (!vendor.inputValues.apiKey) throw new Error("缺少API Key");
  const headers = getHeaders();
  const size = mapImageSize(config.aspectRatio, config.size);

  const requestBody: any = {
    model: model.modelName,
    prompt: config.prompt,
    size: isGlmImage(model.modelName) ? "1280x1280" : size,
  };

  // GLM-Image 仅支持 hd 质量
  if (isGlmImage(model.modelName)) {
    requestBody.quality = "hd";
  } else {
    requestBody.quality = config.size === "4K" ? "hd" : "standard";
  }

  logger(`[智谱AI] 开始生成图片，模型：${model.modelName}，尺寸：${requestBody.size}`);

  const resp = await axios.post(`${API_BASE}/images/generations`, requestBody, { headers });

  if (resp.data.error) {
    throw new Error(`图片生成失败：${resp.data.error.message}`);
  }

  const imageUrl = resp.data.data?.[0]?.url;
  if (!imageUrl) {
    throw new Error("图片生成失败：未返回图片URL");
  }

  logger(`[智谱AI] 图片生成成功，开始转换Base64`);
  return await urlToBase64(imageUrl);
};

// ============================================================
// 视频请求
// ============================================================

const videoRequest = async (config: VideoConfig, model: VideoModel): Promise<string> => {
  if (!vendor.inputValues.apiKey) throw new Error("缺少API Key");
  const headers = getHeaders();

  // 构建请求参数
  const requestBody: any = {
    model: model.modelName,
    prompt: config.prompt,
    size: mapVideoSize(config.aspectRatio, config.resolution),
  };

  // CogVideoX-3 特有参数
  if (model.modelName === "cogvideox-3") {
    requestBody.duration = config.duration;
    requestBody.quality = "quality"; // 高质量模式
  }

  // 音频
  if (model.audio === "optional") {
    requestBody.with_audio = config.audio !== false;
  } else if (model.audio === true) {
    requestBody.with_audio = true;
  }

  // 处理参考图（图生视频 / 首尾帧）
  if (config.referenceList && config.referenceList.length > 0) {
    const imageRefs = config.referenceList.filter((r) => r.type === "image") as Extract<
      ReferenceList,
      { type: "image" }
    >[];

    if (imageRefs.length > 0) {
      // 首尾帧模式
      if (model.mode.includes("startEndRequired") && imageRefs.length >= 2) {
        requestBody.image_url = [imageRefs[0].base64, imageRefs[1].base64];
      } else {
        // 单图模式
        requestBody.image_url = imageRefs[0].base64;
      }
    }
  }

  // 如果是纯文本模式且没有图片，不传 image_url
  if (!requestBody.image_url && config.mode.includes("text")) {
    // 纯文生视频，image_url 不需要
    delete requestBody.image_url;
  }

  logger(`[智谱AI] 提交视频生成任务，模型：${model.modelName}`);
  const submitResp = await axios.post(`${API_BASE}/videos/generations`, requestBody, { headers });

  if (submitResp.data.error) {
    throw new Error(`视频任务提交失败：${submitResp.data.error.message}`);
  }

  const taskId = submitResp.data.id;
  if (!taskId) {
    throw new Error("视频任务提交失败：未返回任务ID");
  }

  logger(`[智谱AI] 视频任务已提交，ID：${taskId}，开始轮询...`);

  // 轮询异步结果
  const pollResult = await pollTask(
    async (): Promise<PollResult> => {
      const queryResp = await axios.get(`${API_BASE}/async-result/${taskId}`, { headers });
      const data = queryResp.data;

      // 智谱异步结果可能直接包含 video_result
      if (data.video_result && data.video_result.length > 0) {
        return { completed: true, data: data.video_result[0].url };
      }

      // 检查 task_status
      if (data.task_status === "FAILED") {
        return { completed: true, error: data.error?.message || "视频生成失败" };
      }

      // 仍在处理中
      logger(`[智谱AI] 视频生成中...`);
      return { completed: false };
    },
    5000, // 5秒轮询
    600000, // 10分钟超时
  );

  if (pollResult.error) {
    throw new Error(pollResult.error);
  }

  logger(`[智谱AI] 视频生成完成，开始转换Base64`);
  return await urlToBase64(pollResult.data!);
};

// ============================================================
// TTS（暂未开放）
// ============================================================

const ttsRequest = async (config: TTSConfig, model: TTSModel): Promise<string> => {
  return "";
};

// ============================================================
// 更新检查
// ============================================================

const checkForUpdates = async (): Promise<{
  hasUpdate: boolean;
  latestVersion: string;
  notice: string;
}> => {
  return { hasUpdate: false, latestVersion: "1.0", notice: "" };
};

const updateVendor = async (): Promise<string> => {
  return "";
};

// ============================================================
// 导出
// ============================================================

exports.vendor = vendor;
exports.textRequest = textRequest;
exports.imageRequest = imageRequest;
exports.videoRequest = videoRequest;
exports.ttsRequest = ttsRequest;
exports.checkForUpdates = checkForUpdates;
exports.updateVendor = updateVendor;

export {};
