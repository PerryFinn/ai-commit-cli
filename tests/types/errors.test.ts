import { describe, expect, it } from "vitest";
import {
  CLIError,
  ConfigError,
  ErrorCode,
  GitError,
  isCLIError,
  NetworkError,
  ValidationError,
  wrapError
} from "@/types/errors";

describe("错误类型 - 单元测试", () => {
  describe("CLIError", () => {
    it("应该正确创建基础错误", () => {
      const error = new CLIError("测试错误", ErrorCode.Unknown, "测试建议");

      expect(error.message).toBe("测试错误");
      expect(error.code).toBe(ErrorCode.Unknown);
      expect(error.suggestion).toBe("测试建议");
      expect(error.name).toBe("CLIError");
    });

    it("应该支持 instanceof 检查", () => {
      const error = new CLIError("测试", ErrorCode.Unknown);
      expect(error instanceof CLIError).toBe(true);
      expect(error instanceof Error).toBe(true);
    });
  });

  describe("ConfigError", () => {
    it("应该正确创建配置错误", () => {
      const error = new ConfigError("配置无效", ErrorCode.ConfigInvalid, {
        configKey: "AIGCM_MODEL_ID"
      });

      expect(error.message).toBe("配置无效");
      expect(error.code).toBe(ErrorCode.ConfigInvalid);
      expect(error.configKey).toBe("AIGCM_MODEL_ID");
      expect(error.name).toBe("ConfigError");
    });

    it("unsupportedKey 应该创建正确的错误", () => {
      const error = ConfigError.unsupportedKey("INVALID_KEY");

      expect(error.message).toContain("不支持的配置 key");
      expect(error.code).toBe(ErrorCode.ConfigKeyUnsupported);
      expect(error.configKey).toBe("INVALID_KEY");
      expect(error.suggestion).toBeDefined();
    });

    it("invalidValue 应该创建正确的错误", () => {
      const error = ConfigError.invalidValue("AIGCM_MODEL_ID", "string");

      expect(error.message).toContain("需要 string 类型");
      expect(error.code).toBe(ErrorCode.ConfigValueInvalid);
      expect(error.configKey).toBe("AIGCM_MODEL_ID");
    });

    it("validationFailed 应该创建正确的错误", () => {
      const error = ConfigError.validationFailed("缺少必要配置");

      expect(error.message).toBe("缺少必要配置");
      expect(error.code).toBe(ErrorCode.ConfigValidationFailed);
      expect(error.suggestion).toContain("config validate");
    });

    it("应该继承 CLIError", () => {
      const error = new ConfigError("测试");
      expect(error instanceof ConfigError).toBe(true);
      expect(error instanceof CLIError).toBe(true);
    });
  });

  describe("NetworkError", () => {
    it("应该正确创建网络错误", () => {
      const error = new NetworkError("请求失败", ErrorCode.NetworkError, {
        statusCode: 500
      });

      expect(error.message).toBe("请求失败");
      expect(error.statusCode).toBe(500);
      expect(error.name).toBe("NetworkError");
    });

    it("timeout 应该创建超时错误", () => {
      const error = NetworkError.timeout(5000);

      expect(error.message).toContain("超时");
      expect(error.code).toBe(ErrorCode.NetworkTimeout);
    });

    it("authFailed 应该创建认证失败错误", () => {
      const error = NetworkError.authFailed();

      expect(error.code).toBe(ErrorCode.ApiAuthFailed);
      expect(error.statusCode).toBe(401);
      expect(error.suggestion).toContain("API_KEY");
    });

    it("rateLimited 应该创建限流错误", () => {
      const error = NetworkError.rateLimited();

      expect(error.code).toBe(ErrorCode.ApiRateLimited);
      expect(error.statusCode).toBe(429);
    });

    it("fromStatusCode 应该根据状态码创建错误", () => {
      expect(NetworkError.fromStatusCode(401).code).toBe(ErrorCode.ApiAuthFailed);
      expect(NetworkError.fromStatusCode(429).code).toBe(ErrorCode.ApiRateLimited);
      expect(NetworkError.fromStatusCode(500).code).toBe(ErrorCode.ApiError);
    });
  });

  describe("GitError", () => {
    it("应该正确创建 Git 错误", () => {
      const error = new GitError("提交失败", ErrorCode.GitCommitFailed);

      expect(error.message).toBe("提交失败");
      expect(error.code).toBe(ErrorCode.GitCommitFailed);
      expect(error.name).toBe("GitError");
    });

    it("notInRepo 应该创建正确的错误", () => {
      const error = GitError.notInRepo();

      expect(error.message).toContain("不是 Git 仓库");
      expect(error.code).toBe(ErrorCode.GitNotRepo);
    });

    it("noStagedChanges 应该创建正确的错误", () => {
      const error = GitError.noStagedChanges();

      expect(error.message).toContain("没有暂存的变更");
      expect(error.code).toBe(ErrorCode.GitNoStagedChanges);
      expect(error.suggestion).toContain("git add");
    });
  });

  describe("ValidationError", () => {
    it("应该正确创建验证错误", () => {
      const error = new ValidationError("输入无效", {
        field: "username"
      });

      expect(error.message).toBe("输入无效");
      expect(error.field).toBe("username");
      expect(error.name).toBe("ValidationError");
    });

    it("invalidInput 应该创建正确的错误", () => {
      const error = ValidationError.invalidInput("email", "格式不正确");

      expect(error.message).toContain("email");
      expect(error.message).toContain("格式不正确");
      expect(error.field).toBe("email");
    });
  });

  describe("isCLIError", () => {
    it("对 CLIError 实例应该返回 true", () => {
      expect(isCLIError(new CLIError("test", ErrorCode.Unknown))).toBe(true);
      expect(isCLIError(new ConfigError("test"))).toBe(true);
      expect(isCLIError(new NetworkError("test"))).toBe(true);
      expect(isCLIError(new GitError("test"))).toBe(true);
      expect(isCLIError(new ValidationError("test"))).toBe(true);
    });

    it("对普通 Error 应该返回 false", () => {
      expect(isCLIError(new Error("test"))).toBe(false);
    });

    it("对非错误值应该返回 false", () => {
      expect(isCLIError("error")).toBe(false);
      expect(isCLIError(null)).toBe(false);
      expect(isCLIError(undefined)).toBe(false);
      expect(isCLIError({})).toBe(false);
    });
  });

  describe("wrapError", () => {
    it("对 CLIError 应该原样返回", () => {
      const original = new ConfigError("test");
      expect(wrapError(original)).toBe(original);
    });

    it("对普通 Error 应该包装为 CLIError", () => {
      const original = new Error("普通错误");
      const wrapped = wrapError(original);

      expect(wrapped instanceof CLIError).toBe(true);
      expect(wrapped.message).toBe("普通错误");
      expect(wrapped.code).toBe(ErrorCode.Unknown);
    });

    it("对字符串应该包装为 CLIError", () => {
      const wrapped = wrapError("字符串错误");

      expect(wrapped instanceof CLIError).toBe(true);
      expect(wrapped.message).toBe("字符串错误");
    });
  });
});
