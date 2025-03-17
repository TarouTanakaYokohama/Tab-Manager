import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Edit, Plus, Save, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";

// 型定義
interface AvailableDomain {
	id: string;
	domain: string;
}

interface CategoryGroup {
	id: string;
	name: string;
}

// TabGroup型の定義
interface TabGroup {
	id: string;
	domain: string;
	urls: Array<{ url: string; title: string; subCategory?: string }>;
	subCategories?: string[];
}

// 親カテゴリ管理モーダルの型定義
interface CategoryManagementModalProps {
	isOpen: boolean;
	onClose: () => void;
	category: {
		id: string;
		name: string;
	};
	domains: TabGroup[];
	onCategoryUpdate?: (categoryId: string, newName: string) => void;
}

export const CategoryManagementModal = ({
	isOpen,
	onClose,
	category,
	domains,
	onCategoryUpdate,
}: CategoryManagementModalProps) => {
	const [isRenaming, setIsRenaming] = useState(false);
	const [newCategoryName, setNewCategoryName] = useState("");
	const [isProcessing, setIsProcessing] = useState(false);
	const [isSaving, setIsSaving] = useState(false); // 保存処理中の状態
	const [availableDomains, setAvailableDomains] = useState<AvailableDomain[]>(
		[],
	);
	const [selectedDomain, setSelectedDomain] = useState("");
	const [localCategoryName, setLocalCategoryName] = useState("");
	const modalContentRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	// モーダルが開いたときの初期化
	useEffect(() => {
		if (isOpen) {
			setNewCategoryName(category.name);
			setLocalCategoryName(category.name);
			setIsRenaming(false);
			setIsProcessing(false);
			loadAvailableDomains();
		}
	}, [isOpen, category]);

	// 追加可能なドメイン一覧を取得
	const loadAvailableDomains = async () => {
		try {
			const { savedTabs = [] } = await chrome.storage.local.get("savedTabs");
			const { parentCategories = [] } =
				await chrome.storage.local.get("parentCategories");

			// 現在のカテゴリのドメインを取得
			const targetCategory = parentCategories.find(
				(cat: ParentCategory) => cat.id === category.id,
			);
			const currentDomainIds = targetCategory?.domains || [];

			// 他のすべてのドメインを取得
			const otherDomains = (savedTabs as TabGroup[])
				.filter((tab) => !currentDomainIds.includes(tab.id))
				.map((tab) => ({ id: tab.id, domain: tab.domain }));

			setAvailableDomains(otherDomains);

			if (otherDomains.length > 0) {
				setSelectedDomain(otherDomains[0].id);
			} else {
				setSelectedDomain("");
			}
		} catch (error) {
			console.error("利用可能なドメインの取得に失敗しました:", error);
		}
	};

	// カテゴリのリネーム処理を開始
	const handleStartRenaming = () => {
		setNewCategoryName(localCategoryName);
		setIsRenaming(true);
		// 入力フィールドにフォーカス
		// 即座にフォーカスと選択を行う
		requestAnimationFrame(() => {
			if (inputRef.current) {
				inputRef.current.focus();
				inputRef.current.select();
			}
		});
	};

	// リネームをキャンセル
	const handleCancelRenaming = () => {
		setIsRenaming(false);
		setNewCategoryName(localCategoryName);
	};

	// カテゴリ名の変更処理
	const handleSaveRenaming = async () => {
		console.log("Modal - handleSaveRenaming開始", {
			currentCategory: category,
			localState: {
				isRenaming,
				isProcessing,
				newCategoryName,
				localCategoryName,
			},
			hasUpdateCallback: !!onCategoryUpdate,
		});

		if (
			!newCategoryName.trim() ||
			newCategoryName.trim() === localCategoryName
		) {
			console.log("Modal - 変更なしまたは空の値のため終了");
			setIsRenaming(false);
			return;
		}

		if (isProcessing) {
			console.log("Modal - 処理中のため終了");
			return;
		}

		setIsProcessing(true);
		const trimmedName = newCategoryName.trim();
		console.log("Modal - 処理開始:", {
			categoryId: category.id,
			oldName: category.name,
			newName: trimmedName,
		});

		try {
			// onCategoryUpdateが提供されていない場合はエラー
			if (!onCategoryUpdate) {
				throw new Error("カテゴリ更新機能が利用できません");
			}

			// カテゴリ名の更新処理を実行
			console.log("Modal - onCategoryUpdate呼び出し開始", {
				categoryId: category.id,
				newName: trimmedName,
			});

			try {
				// 保存開始
				setIsSaving(true);

				// カテゴリの更新を試行
				await onCategoryUpdate(category.id, trimmedName);
				console.log("Modal - onCategoryUpdate呼び出し完了");

				// 保存完了
				setIsSaving(false);

				// 保存が完全に反映されるまで確認
				let isUpdateConfirmed = false;
				let attempts = 0;
				const maxAttempts = 5;

				while (!isUpdateConfirmed && attempts < maxAttempts) {
					await new Promise((resolve) => setTimeout(resolve, 1000));
					const { parentCategories = [] } =
						await chrome.storage.local.get("parentCategories");
					const updatedCategory = parentCategories.find(
						(cat: ParentCategory) => cat.id === category.id,
					);

					if (updatedCategory && updatedCategory.name === trimmedName) {
						console.log("Modal - カテゴリ名の更新を確認:", updatedCategory);
						isUpdateConfirmed = true;
						break;
					}

					console.log(
						`Modal - 更新確認を再試行 (${attempts + 1}/${maxAttempts})`,
					);
					attempts++;
				}

				if (!isUpdateConfirmed) {
					throw new Error("カテゴリ名の更新が確認できません");
				}

				// 更新が確認できたらUIを更新
				setLocalCategoryName(trimmedName);
				setIsRenaming(false);
				toast.success(
					`カテゴリ名を「${category.name}」から「${trimmedName}」に変更しました`,
				);

				// トーストメッセージを表示
				console.log("Modal - カテゴリ更新が完了しました");
			} catch (error) {
				console.error("Modal - カテゴリ名の更新に失敗:", error);
				throw error;
			} finally {
				// 保存状態をリセット
				setIsSaving(false);
				console.log("Modal - 保存状態をリセット");
			}

			// すべての更新が完了したことを確認してからリロード
			if (trimmedName) {
				console.log("Modal - 最終確認開始");
				const finalCheck = await chrome.storage.local.get("parentCategories");
				const finalCategory = finalCheck.parentCategories?.find(
					(cat: ParentCategory) => cat.id === category.id,
				);

				if (finalCategory?.name !== trimmedName) {
					console.error("Modal - 最終確認でカテゴリ名が一致しません:", {
						expected: trimmedName,
						actual: finalCategory?.name,
					});
					throw new Error("カテゴリ名の更新が完了していません");
				}

				// すべての更新が確認できたら親コンポーネントに通知
				console.log("Modal - カテゴリ更新が完了しました");

				// 親コンポーネント側で状態を更新（onCategoryUpdateが既に呼ばれているため、ここでは何もしない）
				setLocalCategoryName(trimmedName);
				setIsRenaming(false);
			}
		} catch (error) {
			console.error("Modal - カテゴリ名の更新に失敗:", {
				error,
				categoryId: category.id,
				oldName: category.name,
				newName: trimmedName,
				isProcessing,
				stack: error instanceof Error ? error.stack : undefined,
			});
			toast.error("カテゴリ名の更新に失敗しました");
		} finally {
			console.log("Modal - 処理完了", {
				isProcessing,
				newCategoryName,
				localCategoryName,
			});
			setIsProcessing(false);
		}
	};

	// ドメインをカテゴリに追加
	const handleAddDomain = async () => {
		if (!selectedDomain || isProcessing) return;

		setIsProcessing(true);

		try {
			// 現在のデータを取得
			const { parentCategories = [] } =
				await chrome.storage.local.get("parentCategories");

			// 対象のカテゴリを検索
			const targetCategory = parentCategories.find(
				(cat: ParentCategory) => cat.id === category.id,
			);
			if (!targetCategory) {
				throw new Error("カテゴリが見つかりません");
			}

			// 選択されたドメインの情報を取得
			const selectedDomainInfo = availableDomains.find(
				(d) => d.id === selectedDomain,
			);
			if (!selectedDomainInfo) {
				throw new Error("ドメインが見つかりません");
			}

			// 重複チェック
			if (
				targetCategory.domains.includes(selectedDomain) ||
				targetCategory.domainNames.includes(selectedDomainInfo.domain)
			) {
				throw new Error("このドメインは既にカテゴリに追加されています");
			}

			// カテゴリを更新
			const updatedCategories = parentCategories.map((cat: ParentCategory) => {
				if (cat.id === category.id) {
					return {
						...cat,
						domains: [...cat.domains, selectedDomain],
						domainNames: [
							...(cat.domainNames || []),
							selectedDomainInfo.domain,
						],
					};
				}
				return cat;
			});

			// 保存
			await chrome.storage.local.set({ parentCategories: updatedCategories });

			toast.success(
				`ドメイン「${selectedDomainInfo.domain}」をカテゴリ「${category.name}」に追加しました`,
			);

			// 追加したドメインをリストから削除
			const updatedAvailableDomains = availableDomains.filter(
				(d) => d.id !== selectedDomain,
			);
			setAvailableDomains(updatedAvailableDomains);

			// セレクトボックスをリセット
			if (updatedAvailableDomains.length > 0) {
				setSelectedDomain(updatedAvailableDomains[0].id);
			} else {
				setSelectedDomain("");
			}
		} catch (error) {
			console.error("ドメインの追加に失敗しました:", error);
			toast.error("ドメインの追加に失敗しました");
		} finally {
			setIsProcessing(false);
		}
	};

	// ドメインをカテゴリから削除
	const handleRemoveDomain = async (domainId: string) => {
		if (isProcessing) return;

		setIsProcessing(true);

		try {
			// 現在のカテゴリデータを取得
			const { parentCategories = [] } =
				await chrome.storage.local.get("parentCategories");

			// 対象のカテゴリを検索
			const targetCategory = parentCategories.find(
				(cat: ParentCategory) => cat.id === category.id,
			);
			if (!targetCategory) {
				throw new Error("カテゴリが見つかりません");
			}

			// 削除するドメインの情報を取得
			const domainInfo = domains.find((d) => d.id === domainId);
			if (!domainInfo) {
				throw new Error("ドメインが見つかりません");
			}

			// カテゴリを更新
			const updatedCategories = parentCategories.map((cat: ParentCategory) => {
				if (cat.id === category.id) {
					return {
						...cat,
						domains: cat.domains.filter((d) => d !== domainId),
						domainNames: (cat.domainNames || []).filter(
							(d) => d !== domainInfo.domain,
						),
					};
				}
				return cat;
			});

			// 保存
			await chrome.storage.local.set({ parentCategories: updatedCategories });

			// 削除したドメインをセレクトボックスに追加
			setAvailableDomains((prev) => [
				...prev,
				{ id: domainInfo.id, domain: domainInfo.domain },
			]);

			toast.success(
				`ドメイン「${domainInfo.domain}」をカテゴリ「${category.name}」から削除しました`,
			);

			// ドメイン一覧を更新
			await loadAvailableDomains();
		} catch (error) {
			console.error("ドメインの削除に失敗しました:", error);
			toast.error("ドメインの削除に失敗しました");
		} finally {
			setIsProcessing(false);
		}
	};

	if (!isOpen) return null;

	return (
		<Dialog
			open={isOpen}
			onOpenChange={() => {
				// 処理中またはリネームモード中は閉じない
				if (isProcessing || isRenaming || isSaving) {
					console.log("Modal - 処理中のためモーダルを閉じません");
					return;
				}

				// リロード中は閉じない
				if (document.readyState === "loading") {
					console.log("Modal - ページリロード中のためモーダルを閉じません");
					return;
				}

				onClose();
			}}
		>
			<DialogContent className="max-h-[80vh] overflow-y-auto">
				<DialogHeader className="text-left">
					<DialogTitle>「{localCategoryName}」の親カテゴリ管理</DialogTitle>
					<DialogDescription>
						カテゴリの名前変更やカテゴリ内のドメイン管理を行います。
					</DialogDescription>
				</DialogHeader>

				<div ref={modalContentRef} className="space-y-4">
					{/* カテゴリ名変更セクション */}
					<div className="mb-4 border-b border-zinc-700 pb-4">
						<div className="flex justify-between items-center mb-2">
							<Label>親カテゴリ名</Label>
							{!isRenaming && (
								<Button
									variant="secondary"
									size="sm"
									onClick={handleStartRenaming}
									className="px-2 py-1 rounded flex items-center gap-1 cursor-pointer"
								>
									<Edit size={14} />
									<span className="ml-1">名前を変更</span>
								</Button>
							)}
						</div>

						{isRenaming ? (
							<div className="mt-2 p-3 border rounded mb-3">
								<div className="text-gray-300 mb-2 text-sm">
									「{localCategoryName}」の新しい名前を入力してください
								</div>
								<Input
									ref={inputRef}
									value={newCategoryName}
									onChange={(e) => setNewCategoryName(e.target.value)}
									placeholder="新しいカテゴリ名"
									className="w-full p-2 border rounded"
									autoFocus
									onBlur={() => {
										if (isProcessing) {
											return; // 処理中は何もしない
										}

										const trimmedName = newCategoryName.trim();
										if (trimmedName && trimmedName !== localCategoryName) {
											handleSaveRenaming();
										} else {
											handleCancelRenaming();
										}
									}}
									onKeyDown={(e) => {
										if (e.key === "Escape") {
											e.preventDefault();
											handleCancelRenaming();
										}
									}}
								/>
							</div>
						) : (
							<div className="p-2 border rounded bg-secondary/20">
								{localCategoryName}
							</div>
						)}
					</div>

					{/* 登録済みドメイン一覧 */}
					<div className="mb-4">
						<Label className="block mb-2">登録済みドメイン</Label>
						<div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-2 border rounded">
							{domains.length === 0 ? (
								<p className="text-gray-500">
									登録されているドメインがありません
								</p>
							) : (
								domains.map((domain) => (
									<Badge
										key={domain.id}
										variant="outline"
										className="px-2 py-1 rounded flex items-center gap-1"
									>
										{domain.domain}
										<Button
											variant="ghost"
											size="sm"
											onClick={() => handleRemoveDomain(domain.id)}
											className="ml-1 text-gray-400 hover:text-gray-200 cursor-pointer"
											aria-label="ドメインを削除"
											disabled={isProcessing}
										>
											<X size={14} />
										</Button>
									</Badge>
								))
							)}
						</div>
					</div>

					{/* ドメイン追加セクション */}
					<div className="mb-4">
						<Label className="block mb-2">新しいドメインを追加</Label>
						{availableDomains.length > 0 ? (
							<div className="flex gap-2">
								<Select
									value={selectedDomain}
									onValueChange={setSelectedDomain}
									disabled={isProcessing}
								>
									<SelectTrigger className="w-full p-2 border rounded cursor-pointer">
										<SelectValue placeholder="ドメインを選択" />
									</SelectTrigger>
									<SelectContent>
										{availableDomains.map((domain) => (
											<SelectItem
												key={domain.id}
												value={domain.id}
												className="cursor-pointer"
											>
												{domain.domain}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								<Button
									variant="default"
									size="icon"
									onClick={(e) => {
										e.preventDefault();
										e.stopPropagation();
										if (!selectedDomain || isProcessing) return;
										handleAddDomain();
									}}
									className="cursor-pointer"
									disabled={!selectedDomain || isProcessing}
								>
									<Plus size={18} />
								</Button>
							</div>
						) : (
							<p className="text-gray-500">
								追加できるドメインがありません。新しいタブグループを作成してください。
							</p>
						)}
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
};
