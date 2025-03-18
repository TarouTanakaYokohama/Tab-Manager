import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import type { CategoryKeywordModalProps } from "@/types/saved-tabs";
import type {
	ParentCategory,
	TabGroup,
	SubCategoryKeyword,
} from "@/utils/storage";
import { Label } from "@/components/ui/label";

import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Edit, Settings, Trash, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";

// カテゴリキーワード管理モーダルコンポーネント
export const CategoryKeywordModal = ({
	group,
	isOpen,
	onClose,
	onSave,
	onDeleteCategory,
	parentCategories: initialParentCategories = [], // デフォルト値を空配列に設定
	onUpdateParentCategories,
	onCreateParentCategory = async (name: string) => {
		const { parentCategories = [] } =
			await chrome.storage.local.get("parentCategories");
		const existingCategories = parentCategories as ParentCategory[];

		// 重複チェック
		if (existingCategories.some((cat: ParentCategory) => cat.name === name)) {
			toast.error("同じ名前の親カテゴリが既に存在します");
			throw new Error("同じ名前の親カテゴリが既に存在します");
		}

		// 新しい親カテゴリを作成
		const newCategory: ParentCategory = {
			id: crypto.randomUUID(),
			name,
			domains: [],
			domainNames: [],
		};

		// 保存
		await chrome.storage.local.set({
			parentCategories: [...existingCategories, newCategory],
		});

		return newCategory;
	},
	onAssignToParentCategory = async (groupId: string, categoryId: string) => {
		const { parentCategories = [] } =
			await chrome.storage.local.get("parentCategories");
		const { savedTabs = [] } = await chrome.storage.local.get("savedTabs");

		const existingTabs = savedTabs as TabGroup[];
		const existingCategories = parentCategories as ParentCategory[];

		const targetGroup = existingTabs.find(
			(tab: TabGroup) => tab.id === groupId,
		);
		if (!targetGroup) {
			toast.error("タブグループが見つかりません");
			throw new Error("タブグループが見つかりません");
		}

		// 更新されたカテゴリ一覧を作成
		const updatedCategories = existingCategories.map((cat: ParentCategory) => {
			// 親カテゴリの関連付けを解除
			if (categoryId === "") {
				return {
					...cat,
					domains: cat.domains.filter((id: string) => id !== groupId),
					domainNames: cat.domainNames.filter(
						(domain: string) => domain !== targetGroup.domain,
					),
				};
			}

			// 選択された親カテゴリに追加
			if (cat.id === categoryId) {
				return {
					...cat,
					domains: [...new Set([...cat.domains, groupId])],
					domainNames: [...new Set([...cat.domainNames, targetGroup.domain])],
				};
			}

			// 他の親カテゴリからは削除
			return {
				...cat,
				domains: cat.domains.filter((id: string) => id !== groupId),
				domainNames: cat.domainNames.filter(
					(domain: string) => domain !== targetGroup.domain,
				),
			};
		});

		// 保存
		await chrome.storage.local.set({ parentCategories: updatedCategories });
	},
}: CategoryKeywordModalProps) => {
	const [activeCategory, setActiveCategory] = useState<string>(
		group.subCategories && group.subCategories.length > 0
			? group.subCategories[0]
			: "",
	);
	const [keywords, setKeywords] = useState<string[]>([]);
	const [newKeyword, setNewKeyword] = useState("");
	const [newSubCategory, setNewSubCategory] = useState("");
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
	const [isProcessing, setIsProcessing] = useState(false);
	const modalContentRef = useRef<HTMLDivElement>(null);
	const [isRenaming, setIsRenaming] = useState(false);
	const [newCategoryName, setNewCategoryName] = useState("");
	const [newParentCategory, setNewParentCategory] = useState("");
	const [internalParentCategories, setInternalParentCategories] = useState<
		ParentCategory[]
	>(initialParentCategories);
	const [selectedParentCategory, setSelectedParentCategory] =
		useState<string>("none");

	// 初期値の設定
	useEffect(() => {
		if (group.parentCategoryId) {
			setSelectedParentCategory(group.parentCategoryId);
			console.log("親カテゴリの初期値を設定:", group.parentCategoryId);
		}
	}, [group.parentCategoryId]);

	const loadParentCategories = async () => {
		if (!isOpen) return;

		try {
			console.log("親カテゴリの状態", {
				current: {
					count: internalParentCategories.length,
					categories: internalParentCategories.map((c: ParentCategory) => ({
						id: c.id,
						name: c.name,
					})),
				},
				selectedId: group.parentCategoryId,
			});

			const { parentCategories: stored = [] } =
				await chrome.storage.local.get("parentCategories");
			const storedCategories = stored as ParentCategory[];

			console.log("ストレージのカテゴリ", {
				count: storedCategories.length,
				categories: storedCategories.map((c) => ({ id: c.id, name: c.name })),
			});

			// 内部状態を更新
			setInternalParentCategories(storedCategories);

			// 親カテゴリを更新
			if (onUpdateParentCategories) {
				// 常に最新のデータで更新
				await onUpdateParentCategories(storedCategories);
				console.log("親カテゴリを更新しました:", {
					count: storedCategories.length,
					categories: storedCategories.map((c) => ({
						id: c.id,
						name: c.name,
						domainCount: c.domains.length,
					})),
				});
			}

			// 親コンポーネントに渡されたデータを確認
			console.log("親カテゴリの状態確認:", {
				propsCategories: initialParentCategories.length,
				storedCategories: storedCategories.length,
				selectedId: group.parentCategoryId,
			});

			// 選択状態の更新 - 親カテゴリを特定
			let newParentId = "none";

			// group.parentCategoryIdが明示的に設定されている場合はそれを使用
			if (group.parentCategoryId) {
				newParentId = group.parentCategoryId;
			}
			// そうでない場合は、ドメインが属している親カテゴリを探す
			else {
				// 各親カテゴリをチェックし、このドメインが含まれているかを確認
				for (const category of storedCategories) {
					// domainsにグループIDが含まれている、またはdomainNamesにドメイン名が含まれている場合
					if (
						category.domains.includes(group.id) ||
						category.domainNames.includes(group.domain)
					) {
						newParentId = category.id;
						console.log(
							`ドメイン「${group.domain}」は親カテゴリ「${category.name}」に属しています`,
						);
						break;
					}
				}
			}

			if (selectedParentCategory !== newParentId) {
				setSelectedParentCategory(newParentId);
				console.log("選択状態を更新:", newParentId);
			}

			// 初期状態の確認
			if (storedCategories.length === 0) {
				console.log("親カテゴリが未作成");
				toast.info("親カテゴリを作成してください");
			}
		} catch (error) {
			console.error("親カテゴリの読み込みに失敗:", error);
			toast.error("親カテゴリの読み込みに失敗しました。再度お試しください。");
		}
	};

	// biome-ignore lint/correctness/useExhaustiveDependencies: loadParentCategoriesは変更されない
	useEffect(() => {
		// モーダルを開いた時に親カテゴリをロード
		const initializeCategories = async () => {
			if (isOpen) {
				console.log("モーダルを開きました - 親カテゴリを初期化");
				await loadParentCategories();

				// ストレージの変更を監視
				const handleStorageChange = (changes: {
					[key: string]: chrome.storage.StorageChange;
				}) => {
					if (changes.parentCategories) {
						console.log("親カテゴリの変更を検出");
						loadParentCategories();
					}
				};

				// ストレージの変更監視を開始
				chrome.storage.onChanged.addListener(handleStorageChange);

				// クリーンアップ
				return () => {
					chrome.storage.onChanged.removeListener(handleStorageChange);
				};
			}
		};

		initializeCategories();
	}, [isOpen]); // isOpenの変更のみを監視

	// アクティブカテゴリが変更されたときのキーワード読み込み
	useEffect(() => {
		if (isOpen && activeCategory) {
			console.log("カテゴリ変更:", activeCategory);
			const categoryKeywords = group.categoryKeywords?.find(
				(ck) => ck.categoryName === activeCategory,
			);
			const keywords = categoryKeywords?.keywords || [];
			console.log("読み込まれたキーワード:", keywords);

			setKeywords(keywords);
			setIsRenaming(false);
			setNewCategoryName("");
		}
	}, [isOpen, activeCategory, group]);

	if (!isOpen) return null;

	// キーワードを追加した時に重複チェックを追加
	const handleAddKeyword = () => {
		if (!newKeyword.trim()) return;

		const trimmedKeyword = newKeyword.trim();
		console.log("追加するキーワード:", trimmedKeyword);
		console.log("既存のキーワード:", keywords);

		// 完全一致する場合のみ重複とみなす（大文字小文字は区別しない）
		const isDuplicate = keywords.some(
			(keyword) => keyword.toLowerCase() === trimmedKeyword.toLowerCase(),
		);

		if (isDuplicate) {
			toast.error("このキーワードは既に追加されています");
			return;
		}

		const updatedKeywords = [...keywords, trimmedKeyword];
		console.log("更新後のキーワード:", updatedKeywords);

		// 状態を更新
		setKeywords(updatedKeywords);
		setNewKeyword("");

		// 即座に保存
		onSave(group.id, activeCategory, updatedKeywords);
	};

	// キーワードを削除した時に自動保存するよう変更
	const handleRemoveKeyword = (keywordToRemove: string) => {
		console.log("削除するキーワード:", keywordToRemove);
		const updatedKeywords = keywords.filter((k) => k !== keywordToRemove);
		console.log("削除後のキーワード:", updatedKeywords);

		setKeywords(updatedKeywords);

		// 即座に保存
		onSave(group.id, activeCategory, updatedKeywords);
	};

	// モーダルコンテンツのクリックイベントの伝播を停止
	const handleContentClick = (e: React.MouseEvent | React.KeyboardEvent) => {
		e.stopPropagation();
	};

	// 子カテゴリ追加機能 - 修正版: 重複チェックと処理中フラグを追加
	const handleAddSubCategory = async () => {
		// 空の場合や処理中の場合は何もしない
		if (!newSubCategory.trim() || isProcessing) return;

		// 既存のカテゴリと重複していないか確認
		if (group.subCategories?.includes(newSubCategory.trim())) {
			alert("このカテゴリ名は既に存在しています");
			return;
		}

		// 処理中フラグをセット
		setIsProcessing(true);

		try {
			// 直接chrome.storage.localから保存されたタブを取得
			const { savedTabs = [] } = await chrome.storage.local.get("savedTabs");

			// 重複しないように更新するため、既存のものを探して更新
			const updatedTabs = savedTabs.map((tab: TabGroup) => {
				// IDが一致するタブグループのみ更新
				if (tab.id === group.id) {
					return {
						...tab,
						subCategories: [
							...(tab.subCategories || []),
							newSubCategory.trim(),
						],
					};
				}
				return tab;
			});

			// 更新したタブグループをストレージに保存
			await chrome.storage.local.set({ savedTabs: updatedTabs });

			// カテゴリを追加したら、それをアクティブにする
			setActiveCategory(newSubCategory.trim());
			setNewSubCategory("");
		} catch (error) {
			console.error("子カテゴリ追加エラー:", error);
		} finally {
			// 処理完了後にフラグをリセット
			setIsProcessing(false);
		}
	};

	// カテゴリを削除する関数 - 修正版
	const handleDeleteCategory = async () => {
		if (!activeCategory) return;

		console.log("カテゴリ削除開始:", activeCategory);

		// 関数の存在確認を追加
		if (typeof onDeleteCategory !== "function") {
			console.error("削除関数が定義されていません");
			return;
		}

		try {
			const categoryToDelete = activeCategory; // 現在のカテゴリを保存
			console.log("削除処理実行:", group.id, categoryToDelete);

			// 削除処理を実行
			await onDeleteCategory(group.id, categoryToDelete);
			console.log("カテゴリ削除成功:", categoryToDelete);

			// 削除後は別のカテゴリを選択
			if (group.subCategories && group.subCategories.length > 1) {
				// 削除したカテゴリ以外のカテゴリを選択
				const updatedSubCategories = group.subCategories.filter(
					(cat: string) => cat !== categoryToDelete,
				);
				if (updatedSubCategories.length > 0) {
					setActiveCategory(updatedSubCategories[0]);
				} else {
					setActiveCategory("");
				}
			} else {
				// カテゴリがなくなった場合
				setActiveCategory("");
			}

			// 削除確認モーダルを閉じる
			setShowDeleteConfirm(false);
		} catch (error) {
			console.error("カテゴリ削除エラー:", error);
		}
	};

	// カテゴリ選択時に削除確認モーダルをリセット
	useEffect(() => {
		setShowDeleteConfirm(false);
	}, []); // 初期化時のみ実行

	// カテゴリのリネーム処理を開始
	const handleStartRenaming = () => {
		setNewCategoryName(activeCategory);
		setIsRenaming(true);
		// 入力フィールドにフォーカスが当たったら全選択状態にする
		setTimeout(() => {
			const inputElement = document.querySelector(
				"input[data-rename-input]",
			) as HTMLInputElement;
			if (inputElement) {
				inputElement.focus();
				inputElement.select(); // テキスト全体を選択状態に
			}
		}, 50);
	};

	// リネームをキャンセル
	const handleCancelRenaming = () => {
		setIsRenaming(false);
		setNewCategoryName("");
	};

	// カテゴリ名の変更を保存
	const handleSaveRenaming = async () => {
		// 変更がない場合や空の場合はリネームモードを終了
		if (!newCategoryName.trim() || newCategoryName.trim() === activeCategory) {
			setIsRenaming(false);
			setNewCategoryName("");
			return;
		}

		// すでに処理中の場合は何もしない
		if (isProcessing) return;

		// 既存のカテゴリと重複していないか確認
		if (group.subCategories?.includes(newCategoryName.trim())) {
			alert("このカテゴリ名は既に存在しています");
			// 入力フィールドにフォーカスを戻す
			setTimeout(() => {
				const inputElement = document.querySelector(
					"input[data-rename-input]",
				) as HTMLInputElement;
				if (inputElement) inputElement.focus();
			}, 50);
			return;
		}

		setIsProcessing(true);

		try {
			// 直接chrome.storage.localから保存されたタブを取得
			const { savedTabs = [] } = await chrome.storage.local.get("savedTabs");

			// 対象のグループを見つけて更新
			const updatedTabs = savedTabs.map((tab: TabGroup) => {
				if (tab.id === group.id) {
					// サブカテゴリの更新
					const updatedSubCategories =
						tab.subCategories?.map((cat) =>
							cat === activeCategory ? newCategoryName.trim() : cat,
						) || [];

					// カテゴリキーワードの更新
					const updatedCategoryKeywords =
						tab.categoryKeywords?.map((ck) => {
							if (ck.categoryName === activeCategory) {
								return { ...ck, categoryName: newCategoryName.trim() };
							}
							return ck;
						}) || [];

					// URLのサブカテゴリも更新
					const updatedUrls = tab.urls.map((url) => {
						if (url.subCategory === activeCategory) {
							return { ...url, subCategory: newCategoryName.trim() };
						}
						return url;
					});

					// サブカテゴリの順序も更新
					let updatedSubCategoryOrder = tab.subCategoryOrder || [];
					if (updatedSubCategoryOrder.includes(activeCategory)) {
						updatedSubCategoryOrder = updatedSubCategoryOrder.map((cat) =>
							cat === activeCategory ? newCategoryName.trim() : cat,
						);
					}

					// 未分類を含む順序も更新
					let updatedAllOrder = tab.subCategoryOrderWithUncategorized || [];
					if (updatedAllOrder.includes(activeCategory)) {
						updatedAllOrder = updatedAllOrder.map((cat) =>
							cat === activeCategory ? newCategoryName.trim() : cat,
						);
					}

					return {
						...tab,
						subCategories: updatedSubCategories,
						categoryKeywords: updatedCategoryKeywords,
						urls: updatedUrls,
						subCategoryOrder: updatedSubCategoryOrder,
						subCategoryOrderWithUncategorized: updatedAllOrder,
					};
				}
				return tab;
			});

			// ストレージに保存
			await chrome.storage.local.set({ savedTabs: updatedTabs });

			// アクティブカテゴリを新しい名前に更新
			setActiveCategory(newCategoryName.trim());

			// リネームモードを終了
			setIsRenaming(false);
			setNewCategoryName("");

			console.log(
				`カテゴリ名を「${activeCategory}」から「${newCategoryName}」に変更しました`,
			);
		} catch (error) {
			console.error("カテゴリ名の変更中にエラーが発生しました:", error);
		} finally {
			setIsProcessing(false);
		}
	};

	if (!isOpen) return null;

	return (
		<Dialog open={isOpen} onOpenChange={onClose}>
			<DialogContent
				className="max-h-[80vh] overflow-y-auto"
				// モーダル全体のクリックイベント伝播を停止
				onClick={(e) => e.stopPropagation()}
				onPointerDown={(e) => e.stopPropagation()}
				onKeyDown={(e) => {
					if (e.key === "Enter" || e.key === " ") {
						e.stopPropagation();
					}
				}}
			>
				<DialogHeader className="text-left">
					<DialogTitle>「{group.domain}」のカテゴリ管理</DialogTitle>
					<DialogDescription>
						カテゴリの追加、削除、リネーム、キーワード設定を行います。
					</DialogDescription>
				</DialogHeader>

				{/* 親カテゴリ管理セクション */}
				<div
					className="mb-6 border-b border-zinc-700 pb-4"
					// 親カテゴリセクション全体のイベント伝播を停止
					onClick={(e) => e.stopPropagation()}
					onPointerDown={(e) => e.stopPropagation()}
					onKeyDown={(e) => {
						if (e.key === "Enter" || e.key === " ") {
							e.stopPropagation();
						}
					}}
				>
					<h4 className="text-md font-medium mb-2 text-gray-300">
						親カテゴリ管理
					</h4>

					{/* 新しい親カテゴリの作成 */}
					<div className="mb-4">
						<Label
							htmlFor="new-parent-category"
							className="text-sm text-gray-400 mb-2"
						>
							新しい親カテゴリを作成
						</Label>
						<div
							className="flex gap-2"
							onClick={(e) => e.stopPropagation()}
							onKeyDown={(e) => {
								if (e.key === "Enter" || e.key === " ") {
									e.stopPropagation();
								}
							}}
						>
							<Input
								id="new-parent-category"
								value={newParentCategory}
								onChange={(e) => setNewParentCategory(e.target.value)}
								placeholder="新しい親カテゴリ名"
								className="flex-grow"
								onClick={(e) => e.stopPropagation()}
								onPointerDown={(e) => e.stopPropagation()}
							/>
							<Button
								onClick={async (e) => {
									// イベント伝播を防止
									e.stopPropagation();
									e.preventDefault();

									if (!newParentCategory.trim()) return;
									if (!onCreateParentCategory || !onAssignToParentCategory) {
										toast.error("親カテゴリの作成機能が利用できません");
										return;
									}
									try {
										const category = await onCreateParentCategory(
											newParentCategory.trim(),
										);
										if (!category || !category.id) {
											throw new Error("作成された親カテゴリの情報が不正です");
										}
										setSelectedParentCategory(category.id);
										try {
											await onAssignToParentCategory(group.id, category.id);
											setNewParentCategory("");
											toast.success(
												"親カテゴリを作成し、ドメインを割り当てました",
											);
										} catch (assignError) {
											console.error("親カテゴリの割り当てに失敗:", assignError);
											toast.error(
												"親カテゴリは作成されましたが、ドメインの割り当てに失敗しました",
											);
										}
									} catch (error) {
										console.error("親カテゴリの作成に失敗:", error);
										toast.error(
											error instanceof Error
												? error.message
												: "親カテゴリの作成に失敗しました",
										);
									}
								}}
								disabled={!newParentCategory.trim()}
								variant="secondary"
								onPointerDown={(e) => e.stopPropagation()}
							>
								作成
							</Button>
						</div>
					</div>

					{/* 親カテゴリの選択 */}
					<div
						className="mb-4"
						onClick={(e) => e.stopPropagation()}
						onPointerDown={(e) => e.stopPropagation()}
						onKeyDown={(e) => {
							if (e.key === "Enter" || e.key === " ") {
								e.stopPropagation();
							}
						}}
					>
						<Label
							htmlFor="parent-category"
							className="text-sm text-gray-400 mb-2"
						>
							ドメインの親カテゴリを選択
						</Label>
						<Select
							value={selectedParentCategory}
							onValueChange={async (value) => {
								console.log("親カテゴリの選択:", {
									newValue: value,
									currentValue: selectedParentCategory,
									availableCategories: internalParentCategories.map(
										(c) => c.name,
									),
								});

								setSelectedParentCategory(value);
								if (!onAssignToParentCategory) {
									toast.error("親カテゴリの更新機能が利用できません");
									return;
								}

								try {
									if (value === "none") {
										await onAssignToParentCategory(group.id, "");
										toast.success("親カテゴリを解除しました");
										console.log("親カテゴリを解除完了");
									} else {
										await onAssignToParentCategory(group.id, value);
										const category = internalParentCategories.find(
											(c) => c.id === value,
										);
										toast.success(
											`親カテゴリを「${category?.name}」に更新しました`,
										);
										console.log("親カテゴリを更新完了:", category?.name);
									}
								} catch (error) {
									console.error("親カテゴリの割り当てに失敗:", error);
									toast.error(
										"親カテゴリの更新に失敗しました。再度お試しください。",
									);
								}
							}}
						>
							<SelectTrigger
								className="w-full"
								onClick={(e) => e.stopPropagation()}
								onPointerDown={(e) => e.stopPropagation()}
							>
								<SelectValue placeholder="親カテゴリを選択" />
							</SelectTrigger>
							<SelectContent
								onPointerDownOutside={(e) => {
									e.preventDefault();
								}}
								className="p-0"
								onClick={(e) => e.stopPropagation()}
								onPointerDown={(e) => e.stopPropagation()}
							>
								<ScrollArea
									className="h-[120px]"
									onClick={(e) => e.stopPropagation()}
									onPointerDown={(e) => e.stopPropagation()}
									onKeyDown={(e) => {
										if (e.key === "Enter" || e.key === " ") {
											e.stopPropagation();
										}
									}}
								>
									<div
										className="p-1"
										onClick={(e) => e.stopPropagation()}
										onPointerDown={(e) => e.stopPropagation()}
										onKeyDown={(e) => {
											if (e.key === "Enter" || e.key === " ") {
												e.stopPropagation();
											}
										}}
									>
										<SelectItem
											value="none"
											onPointerDown={(e) => e.stopPropagation()}
											onClick={(e) => e.stopPropagation()}
											className="cursor-pointer"
										>
											未分類
										</SelectItem>
										{internalParentCategories.map((category) => (
											<SelectItem
												key={category.id}
												value={category.id}
												onPointerDown={(e) => e.stopPropagation()}
												onClick={(e) => e.stopPropagation()}
												className="cursor-pointer truncate"
												title={category.name}
											>
												{category.name}
											</SelectItem>
										))}
									</div>
								</ScrollArea>
							</SelectContent>
						</Select>
					</div>
				</div>

				<div
					ref={modalContentRef}
					onClick={handleContentClick}
					onKeyDown={(e) => {
						if (e.key === "Enter" || e.key === " ") {
							handleContentClick(e);
						}
					}}
					role="presentation"
					className="space-y-4"
				>
					{/* 子カテゴリ追加セクション */}
					<div className="mb-4 border-b border-zinc-700 pb-4">
						<h4 className="text-md font-medium mb-2 text-gray-300">
							新しい子カテゴリを追加
						</h4>
						<div className="flex">
							<Input
								value={newSubCategory}
								onChange={(e) => setNewSubCategory(e.target.value)}
								placeholder="新しいカテゴリ名を入力"
								className="flex-grow p-2 border rounded"
								onKeyDown={(e) => {
									if (e.key === "Enter") {
										e.preventDefault();
										handleAddSubCategory();
									}
								}}
								onBlur={() => {
									if (newSubCategory.trim()) {
										handleAddSubCategory();
									}
								}}
							/>
						</div>
					</div>

					{/* 既存のカテゴリ管理セクション */}
					{group.subCategories && group.subCategories.length > 0 ? (
						<>
							<div className="mb-4">
								<div className="flex justify-between items-center mb-2">
									<Label htmlFor="category-select">
										キーワード設定を行うカテゴリを選択
									</Label>

									<div className="flex gap-2">
										{!isRenaming && (
											<Tooltip>
												<TooltipTrigger asChild>
													<Button
														variant="secondary"
														size="sm"
														onClick={handleStartRenaming}
														className="px-2 py-1 rounded flex items-center gap-1 cursor-pointer"
														title="カテゴリ名を変更"
														disabled={!activeCategory}
													>
														<Edit size={14} />
														<span className="lg:inline hidden">名前を変更</span>
													</Button>
												</TooltipTrigger>
												<TooltipContent side="top" className="lg:hidden block">
													カテゴリ名を変更
												</TooltipContent>
											</Tooltip>
										)}

										<Tooltip>
											<TooltipTrigger asChild>
												<Button
													variant="secondary"
													size="sm"
													onClick={() => setShowDeleteConfirm(true)}
													className="px-2 py-1 rounded flex items-center gap-1 cursor-pointer"
													title="現在のカテゴリを削除"
													disabled={!activeCategory}
												>
													<Trash size={14} />
													<span className="lg:inline hidden">
														現在のカテゴリを削除
													</span>
												</Button>
											</TooltipTrigger>
											<TooltipContent side="top" className="lg:hidden block">
												現在のカテゴリを削除
											</TooltipContent>
										</Tooltip>
									</div>
								</div>

								{/* リネームフォーム */}
								{isRenaming && (
									<div className="mt-2 p-3 border rounded mb-3">
										<div className="text-gray-300 mb-2 text-sm">
											「{activeCategory}」の新しい名前を入力してください
											<br />
											<span className="text-xs text-gray-400">
												(入力後、フォーカスを外すかEnterキーで保存されます。キャンセルするにはEscを押してください)
											</span>
										</div>
										<Input
											value={newCategoryName}
											onChange={(e) => setNewCategoryName(e.target.value)}
											placeholder="新しいカテゴリ名"
											className="w-full p-2 border rounded"
											autoFocus
											data-rename-input="true"
											onBlur={handleSaveRenaming}
											onKeyDown={(e) => {
												if (e.key === "Enter") {
													e.preventDefault();
													e.currentTarget.blur();
												} else if (e.key === "Escape") {
													e.preventDefault();
													handleCancelRenaming();
												}
											}}
										/>
									</div>
								)}

								{/* 削除確認UI */}
								{showDeleteConfirm && (
									<div className="mt-2 p-3 border rounded mb-3">
										<p className="text-gray-300 mb-2">
											「{activeCategory}」カテゴリを削除しますか？
											<br />
											<span className="text-xs">
												このカテゴリに属するすべてのタブは未分類になります
											</span>
										</p>
										<div className="flex justify-end gap-2">
											<Button
												variant="secondary"
												size="sm"
												onClick={() => setShowDeleteConfirm(false)}
												className="text-primary-foreground px-2 py-1 rounded cursor-pointer"
											>
												キャンセル
											</Button>
											<Button
												variant="destructive"
												size="sm"
												onClick={handleDeleteCategory}
												className="flex items-center gap-1 cursor-pointer"
											>
												<Trash size={14} />
												<span className="lg:inline hidden">削除する</span>
											</Button>
										</div>
									</div>
								)}

								<Select
									value={activeCategory}
									onValueChange={setActiveCategory}
									disabled={isRenaming}
								>
									<SelectTrigger className="w-full p-2 border rounded cursor-pointer">
										<SelectValue placeholder="カテゴリを選択" />
									</SelectTrigger>
									<SelectContent>
										{group.subCategories.map((cat) => (
											<SelectItem
												key={cat}
												value={cat}
												className="cursor-pointer"
											>
												{cat}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>

							{/* キーワード設定セクション */}
							<div className="mb-4">
								<Label
									htmlFor="keyword-input"
									className="block text-sm text-gray-400 mb-2"
								>
									「{activeCategory}」カテゴリのキーワード
									<span className="text-xs text-gray-500 ml-2">
										（タイトルにキーワードが含まれていると自動的にこのカテゴリに分類されます）
									</span>
								</Label>

								<div className="mb-2 flex">
									<Input
										id="keyword-input"
										value={newKeyword}
										onChange={(e) => setNewKeyword(e.target.value)}
										placeholder="新しいキーワードを入力"
										className="flex-grow p-2 border rounded"
										onKeyDown={(e) => {
											if (e.key === "Enter") {
												e.preventDefault();
												handleAddKeyword();
											}
										}}
										onBlur={() => {
											if (newKeyword.trim()) {
												handleAddKeyword();
											}
										}}
										disabled={isRenaming}
									/>
								</div>

								<div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-2 border rounded">
									{keywords.length === 0 ? (
										<p className="text-gray-500">キーワードがありません</p>
									) : (
										keywords.map((keyword) => (
											<Badge
												key={keyword}
												variant="outline"
												className="px-2 py-1 rounded flex items-center gap-1"
											>
												{keyword}
												<Button
													variant="ghost"
													size="sm"
													onClick={() => handleRemoveKeyword(keyword)}
													className="ml-1 text-gray-400 hover:text-gray-200 cursor-pointer"
													aria-label="キーワードを削除"
													disabled={isRenaming}
												>
													<X size={14} />
												</Button>
											</Badge>
										))
									)}
								</div>
							</div>
						</>
					) : (
						<p className="text-gray-400 mb-4">
							このドメインには子カテゴリがありません。上記のフォームから子カテゴリを追加してください。
						</p>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
};
