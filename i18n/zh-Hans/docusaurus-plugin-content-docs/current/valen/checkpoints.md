---
title: 保存、恢复与导出
---

# 保存与恢复

训练将日志和配置写入输出目录，最新 checkpoint 保存在 `latest/`，每次保存会覆盖它。要保留某一步，在保存结束后复制整个目录。冻结权重仍依赖原来的 `model_path`。

```bash
python -m valen.train --config finetune.json --resume output/domain/run/latest
```

`--resume` 继续原训练，恢复优化器、随机状态和数据游标，保持原进程数、数据与学习率。需要更换数据或训练阶段时，用 `--initialize` 开始新实验。

## 加载

```bash
python -m valen.inference --checkpoint output/domain/run/latest \
  --data test.jsonl --output predictions.jsonl
```

## 导出

训练 checkpoint 不是可独立部署的模型。Adapter 导出仍需匹配基座；完整导出将 adapter 合并入基座，全量 SFT 则导出全部训练权重。

使用现有[导出工具](https://github.com/Valen-Team/Valen/blob/main/scripts/export/qwen/merge_checkpoint.py)，它要求已完成 epoch 的训练记录和经过验证的基座 manifest。短程 smoke 不满足完整发布条件。导出后先核对原生预测，再按 [ONNX](./onnx.md) 或 [GGUF](./gguf.md) 部署。
