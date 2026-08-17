package facebook

import (
	"context"
	"fmt"
)

type ImportStrategy string

const (
	StrategyAutoWithFallback ImportStrategy = "AUTO_WITH_MANUAL_FALLBACK"
	StrategyOfficialAPIFirst ImportStrategy = "OFFICIAL_API_FIRST"
	StrategyBrowserAvailable ImportStrategy = "BROWSER_WHEN_AVAILABLE"
	StrategyManualOnly       ImportStrategy = "MANUAL_ONLY"
)

type ImportManager struct {
	Strategy             ImportStrategy
	MetaProvider         *MetaFacebookProvider
	BrowserAgentProvider *BrowserAgentProvider
	BrowserProvider      *BrowserProvider
	ManualProvider       *ManualProvider
}

func NewImportManager(strategy ImportStrategy) *ImportManager {
	if strategy == "" {
		strategy = StrategyAutoWithFallback
	}

	return &ImportManager{
		Strategy:             strategy,
		MetaProvider:         NewMetaFacebookProvider(),
		BrowserAgentProvider: NewBrowserAgentProvider(),
		BrowserProvider:      NewBrowserProvider(),
		ManualProvider:       NewManualProvider(),
	}
}

func (im *ImportManager) ProcessImport(ctx context.Context, rawURL string) (*ImportPostResult, error) {
	if im.Strategy == StrategyManualOnly {
		return im.ManualProvider.ImportPost(ctx, rawURL)
	}

	// 1. Try Meta Graph API Provider
	if im.MetaProvider.CanHandle(ctx, rawURL) {
		res, err := im.MetaProvider.ImportPost(ctx, rawURL)
		if err == nil {
			return res, nil
		}
	}

	// 2. Try Persistent OpenClaw Browser Agent Provider
	if im.Strategy == StrategyAutoWithFallback || im.Strategy == StrategyBrowserAvailable {
		if im.BrowserAgentProvider.CanHandle(ctx, rawURL) {
			res, err := im.BrowserAgentProvider.ImportPost(ctx, rawURL)
			if err == nil {
				return res, nil
			}
		}

		// Fallback to secondary browser provider
		if im.BrowserProvider.CanHandle(ctx, rawURL) {
			res, err := im.BrowserProvider.ImportPost(ctx, rawURL)
			if err == nil {
				return res, nil
			}
		}
	}

	return nil, fmt.Errorf("MANUAL_REQUIRED: Post requires manual authorization or persistent browser login")
}
