import "@/assets/global.css";
import { useEffect, useState, useRef } from "react";
import { createRoot } from "react-dom/client";
import { getUserSettings, saveUserSettings } from "../../utils/storage";
import type {
	UserSettings,
	ParentCategory,
	TabGroup,
} from "../../utils/storage";
import {
	defaultSettings,
	getParentCategories,
	saveParentCategories,
	createParentCategory,
	setCategoryKeywords,
} from "../../utils/storage";
// lucide-reactからアイコンをインポート
import { X, Plus, Trash, Edit, Check } from "lucide-react";

// UIコンポーネントのインポート
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox"; // Switchの代わりにCheckboxをインポート
import { Textarea } from "@/components/ui/textarea";
import {
	Tooltip,
	TooltipTrigger,
	TooltipContent,
} from "@/components/ui/tooltip";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

// テーマ関連のimport
import { useTheme } from "@/components/theme-provider";

const SubCategoryKeywordManager = ({ tabGroup }: { tabGroup: TabGroup }) => {
	const [activeCategory, setActiveCategory] = useState<string | null>(null);
	const [keywords, setKeywords] = useState<string[]>([]);
	const [newKeyword, setNewKeyword] = useState("");
	const [newSubCategory, setNewSubCategory] = useState("");

	// リネームモード用の状態を追加
	const [isRenamingSubCategory, setIsRenamingSubCategory] = useState(false);
	const [newCategoryName, setNewCategoryName] = useState("");
	const renameInputRef = useRef<HTMLInputElement>(null);

	// タブグループを更新するヘルパー関数
	const updateTabGroup = async (updatedTabGroup: TabGroup) => {
		try {
			const { savedTabs = [] } = await chrome.storage.local.get("savedTabs");
			const updatedTabs = savedTabs.map((tab: TabGroup) =>
				tab.id === updatedTabGroup.id ? updatedTabGroup : tab,
			);
			await chrome.storage.local.set({ savedTabs: updatedTabs });
			return true;
		} catch (error) {
			console.error("タブグループ更新エラー:", error);
			return false;
		}
	};

	const handleCategorySelect = (categoryName: string) => {
		// リネームモード中なら終了
		if (isRenamingSubCategory) {
			setIsRenamingSubCategory(false);
		}
		setActiveCategory(categoryName);
		const categoryKeywords = tabGroup.categoryKeywords?.find(
			(ck) => ck.categoryName === categoryName,
		);
		setKeywords(categoryKeywords?.keywords || []);
	};

	// キーワード追加関数に重複チェックを追加
	const handleAddKeyword = () => {
		if (newKeyword.trim() && activeCategory) {
			// 重複チェックを追加
			if (
				keywords.some(
					(keyword) =>
						keyword.toLowerCase() === newKeyword.trim().toLowerCase(),
				)
			) {
				alert("このキーワードは既に追加されています");
				return;
			}

			const updatedKeywords = [...keywords, newKeyword.trim()];
			setKeywords(updatedKeywords);
			setCategoryKeywords(tabGroup.id, activeCategory, updatedKeywords)
				.then(() => setNewKeyword(""))
				.catch((err) => console.error("キーワード保存エラー:", err));
		}
	};

	// キーワードを削除した時に自動保存する処理を修正
	const handleRemoveKeyword = async (keywordToRemove: string) => {
		if (activeCategory) {
			try {
				// キーワードをフィルタリング
				const updatedKeywords = keywords.filter((k) => k !== keywordToRemove);

				// UI状態を先に更新
				setKeywords(updatedKeywords);

				// ストレージに保存
				await setCategoryKeywords(tabGroup.id, activeCategory, updatedKeywords);

				console.log(`キーワード "${keywordToRemove}" を削除しました`);
			} catch (error) {
				console.error("キーワード削除エラー:", error);

				// エラー時はキーワードリストを再取得して状態を元に戻す
				const categoryKeywords = tabGroup.categoryKeywords?.find(
					(ck) => ck.categoryName === activeCategory,
				);
				setKeywords(categoryKeywords?.keywords || []);

				// エラーを表示
				alert("キーワードの削除に失敗しました。再度お試しください。");
			}
		}
	};

	// 新しい子カテゴリを追加
	const handleAddSubCategory = async () => {
		if (newSubCategory.trim()) {
			const categoryName = newSubCategory.trim();

			// 既存の子カテゴリと重複していないか確認
			if (tabGroup.subCategories?.includes(categoryName)) {
				alert("この子カテゴリは既に存在します");
				return;
			}

			// 子カテゴリを追加
			const updatedTabGroup = {
				...tabGroup,
				subCategories: [...(tabGroup.subCategories || []), categoryName],
				categoryKeywords: [
					...(tabGroup.categoryKeywords || []),
					{ categoryName, keywords: [] },
				],
			};

			const success = await updateTabGroup(updatedTabGroup);
			if (success) {
				setNewSubCategory("");
				setActiveCategory(categoryName); // 新しいカテゴリを選択状態に
				setKeywords([]);
			}
		}
	};

	// 子カテゴリ削除関数を完全に書き換え - saved-tabs/main.tsxのパターンに基づく
	const handleRemoveSubCategory = async (categoryToRemove: string) => {
		console.log(`子カテゴリの削除を開始: "${categoryToRemove}"`);

		try {
			// 確認ダイアログを一時的にスキップ (問題特定のため)
			// if (confirm(`子カテゴリ "${categoryToRemove}" を削除してもよろしいですか？`)) {

			// 選択中のカテゴリを削除する場合は選択を解除
			if (activeCategory === categoryToRemove) {
				setActiveCategory(null);
				setKeywords([]);
			}

			// saved-tabs/main.tsxのパターンに基づく直接的な実装
			console.log("削除するカテゴリ:", categoryToRemove);
			console.log("タブグループID:", tabGroup.id);

			// タブの情報を取得
			const { savedTabs = [] } = await chrome.storage.local.get("savedTabs");
			console.log("取得したsavedTabs:", savedTabs);

			// 対象のタブグループを探す
			const groupToUpdate = savedTabs.find(
				(g: TabGroup) => g.id === tabGroup.id,
			);
			console.log("更新対象のグループ:", groupToUpdate);

			if (!groupToUpdate) {
				console.error("タブグループが見つかりません");
				return;
			}

			// 子カテゴリリストと関連キーワードからカテゴリを削除
			const updatedSubCategories = (groupToUpdate.subCategories || []).filter(
				(cat: string) => cat !== categoryToRemove,
			);

			const updatedCategoryKeywords = (
				groupToUpdate.categoryKeywords || []
			).filter(
				(ck: { categoryName: string }) => ck.categoryName !== categoryToRemove,
			);

			console.log("更新後のサブカテゴリ:", updatedSubCategories);
			console.log("更新後のキーワード設定:", updatedCategoryKeywords);

			// グループを更新
			const updatedGroup = {
				...groupToUpdate,
				subCategories: updatedSubCategories,
				categoryKeywords: updatedCategoryKeywords,
			};

			// 保存
			const updatedTabs = savedTabs.map((g: TabGroup) =>
				g.id === tabGroup.id ? updatedGroup : g,
			);

			// ストレージに保存
			await chrome.storage.local.set({ savedTabs: updatedTabs });
			console.log("ストレージに保存完了");

			alert(`カテゴリ "${categoryToRemove}" を削除しました`);
			// }
		} catch (error) {
			console.error("子カテゴリ削除エラー:", error);
			alert(`カテゴリの削除中にエラーが発生しました: ${error}`);
		}
	};

	// リネームモードを開始する関数
	const startRenameMode = () => {
		if (!activeCategory) return;

		setIsRenamingSubCategory(true);
		setNewCategoryName(activeCategory);

		// 入力フィールドにフォーカスを当てる（遅延実行）
		setTimeout(() => {
			if (renameInputRef.current) {
				renameInputRef.current.focus();
				renameInputRef.current.select();
			}
		}, 50);
	};

	// リネームを完了する関数
	const completeRename = async () => {
		if (!isRenamingSubCategory || !activeCategory || !newCategoryName.trim()) {
			setIsRenamingSubCategory(false);
			return;
		}

		// 名前が変わっていない場合は何もしない
		if (newCategoryName.trim() === activeCategory) {
			setIsRenamingSubCategory(false);
			return;
		}

		// 既存のカテゴリ名と重複していないか確認
		if (tabGroup.subCategories?.includes(newCategoryName.trim())) {
			alert("このカテゴリ名は既に存在しています");
			setNewCategoryName(activeCategory); // 元の名前に戻す
			return;
		}

		try {
			await handleRenameCategory(activeCategory, newCategoryName.trim());

			// リネームが成功したら、アクティブカテゴリを新しい名前に更新
			setActiveCategory(newCategoryName.trim());
			setIsRenamingSubCategory(false);
		} catch (error) {
			console.error("カテゴリ名変更エラー:", error);
			alert("カテゴリ名の変更に失敗しました");
		}
	};

	// カテゴリ名変更の処理関数
	const handleRenameCategory = async (oldName: string, newName: string) => {
		if (!oldName || !newName || oldName === newName) return;

		console.log(`カテゴリ名を変更: ${oldName} → ${newName}`);

		// ストレージからタブグループを取得
		const { savedTabs = [] } = await chrome.storage.local.get("savedTabs");

		const updatedTabs = savedTabs.map((tab: TabGroup) => {
			if (tab.id === tabGroup.id) {
				// 1. subCategories配列を更新
				const updatedSubCategories =
					tab.subCategories?.map((cat) => (cat === oldName ? newName : cat)) ||
					[];

				// 2. categoryKeywords内の該当カテゴリを更新
				const updatedCategoryKeywords =
					tab.categoryKeywords?.map((ck) => {
						if (ck.categoryName === oldName) {
							return { ...ck, categoryName: newName };
						}
						return ck;
					}) || [];

				// 3. 各URLのサブカテゴリ参照を更新
				const updatedUrls = tab.urls.map((url) => {
					if (url.subCategory === oldName) {
						return { ...url, subCategory: newName };
					}
					return url;
				});

				// 4. カテゴリ順序配列があれば更新
				const updatedSubCategoryOrder =
					tab.subCategoryOrder?.map((cat) =>
						cat === oldName ? newName : cat,
					) || [];

				const updatedSubCategoryOrderWithUncategorized =
					tab.subCategoryOrderWithUncategorized?.map((cat) =>
						cat === oldName ? newName : cat,
					) || [];

				return {
					...tab,
					subCategories: updatedSubCategories,
					categoryKeywords: updatedCategoryKeywords,
					urls: updatedUrls,
					subCategoryOrder: updatedSubCategoryOrder,
					subCategoryOrderWithUncategorized:
						updatedSubCategoryOrderWithUncategorized,
				};
			}
			return tab;
		});

		// 更新したタブをストレージに保存
		await chrome.storage.local.set({ savedTabs: updatedTabs });
		console.log(`カテゴリ名の変更を完了: ${oldName} → ${newName}`);
	};

	// キャンセル時の処理
	const cancelRename = () => {
		setIsRenamingSubCategory(false);
		setNewCategoryName(activeCategory || "");
	};

	if (!tabGroup.subCategories || tabGroup.subCategories.length === 0) {
		return (
			<div className="mt-4 border-t border-border pt-4">
				<p className="text-muted-foreground mb-3">
					このドメインには子カテゴリがありません。
				</p>
				<div className="mb-4">
					<Label
						htmlFor="new-subcategory"
						className="block text-sm font-medium text-foreground mb-1"
					>
						新しい子カテゴリを追加
					</Label>
					<Input
						id="new-subcategory"
						type="text"
						value={newSubCategory}
						onChange={(e) => setNewSubCategory(e.target.value)}
						onBlur={handleAddSubCategory}
						placeholder="子カテゴリ名（入力後にフォーカスを外すと保存）"
						className="w-full p-2 border border-border bg-input text-foreground rounded focus:ring-2 focus:ring-ring"
						onKeyDown={(e) => {
							if (e.key === "Enter") {
								e.preventDefault();
								handleAddSubCategory();
							}
						}}
					/>
				</div>
			</div>
		);
	}

	return (
		<div className="mt-4 border-t border-border pt-4">
			<h4 className="text-md font-medium mb-2 text-foreground">
				子カテゴリキーワード管理
			</h4>

			{/* 新しい子カテゴリの追加フォーム */}
			<div className="mb-4">
				<Label
					htmlFor="new-subcategory"
					className="block text-sm font-medium text-foreground mb-1"
				>
					新しい子カテゴリを追加
				</Label>
				<Input
					id="new-subcategory"
					type="text"
					value={newSubCategory}
					onChange={(e) => setNewSubCategory(e.target.value)}
					onBlur={handleAddSubCategory}
					placeholder="子カテゴリ名（入力後にフォーカスを外すと保存）"
					className="w-full p-2 border border-border bg-input text-foreground rounded focus:ring-2 focus:ring-ring"
					onKeyDown={(e) => {
						if (e.key === "Enter") {
							e.preventDefault();
							handleAddSubCategory();
						}
					}}
				/>
			</div>

			{/* 子カテゴリボタン一覧 - レスポンシブ対応を改善 */}
			<div className="flex flex-wrap gap-2 mb-3">
				{tabGroup.subCategories.map((category) => (
					<div key={category} className="flex items-center max-w-full">
						<Button
							type="button"
							onClick={() => handleCategorySelect(category)}
							variant={activeCategory === category ? "secondary" : "outline"}
							size="sm"
							className={`rounded-r-none truncate max-w-[180px] cursor-pointer ${
								activeCategory === category
									? "bg-secondary text-secondary-foreground"
									: "bg-muted hover:bg-secondary/80 text-foreground"
							}`}
							title={category} // 長い名前の場合はホバーでフル表示
						>
							{category}
						</Button>
						<Button
							type="button"
							onClick={() => handleRemoveSubCategory(category)}
							variant="outline"
							size="sm"
							className="rounded-l-none flex-shrink-0 cursor-pointer"
							title="カテゴリを削除"
							aria-label={`カテゴリ ${category} を削除`}
						>
							<X size={14} />
						</Button>
					</div>
				))}
			</div>

			{activeCategory && (
				<div className="mt-2">
					{/* カテゴリリネーム機能 - レスポンシブ対応を改善 */}
					{isRenamingSubCategory ? (
						<div className="mb-4 relative">
							<Label
								htmlFor="rename-category"
								className="block text-sm text-foreground mb-1"
							>
								カテゴリ名を変更
							</Label>
							<div className="flex">
								<Input
									id="rename-category"
									ref={renameInputRef}
									type="text"
									value={newCategoryName}
									onChange={(e) => setNewCategoryName(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === "Enter") {
											e.preventDefault();
											completeRename();
										} else if (e.key === "Escape") {
											e.preventDefault();
											cancelRename();
										}
									}}
									className="flex-grow p-2 border rounded-l bg-input border-border text-foreground"
								/>
								<div className="flex flex-shrink-0">
									<Button
										type="button"
										onClick={completeRename}
										variant="secondary"
										size="icon"
										className="bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded-none"
										title="変更を保存"
									>
										<Check size={16} />
									</Button>
									<Button
										type="button"
										onClick={cancelRename}
										variant="outline"
										size="icon"
										className="rounded-l-none"
										title="キャンセル"
									>
										<X size={16} />
									</Button>
								</div>
							</div>
							<div className="text-xs text-muted-foreground mt-1">
								Enter で確定、Escape でキャンセル
							</div>
						</div>
					) : (
						<div className="flex items-center justify-between mb-3">
							<div className="flex items-center gap-2 overflow-hidden">
								<h4
									className="font-medium text-foreground truncate max-w-[200px]"
									title={activeCategory}
								>
									「{activeCategory}」カテゴリのキーワード
								</h4>
								<Button
									type="button"
									onClick={startRenameMode}
									variant="outline"
									size="sm"
									className="text-xs bg-muted hover:bg-muted/70 text-foreground flex-shrink-0"
									title="カテゴリ名を変更"
								>
									リネーム
								</Button>
							</div>
						</div>
					)}

					<div className="mb-2">
						<Label
							htmlFor={`keyword-input-${activeCategory}`}
							className="block text-sm text-foreground mb-1"
						>
							キーワード
							<span className="text-xs text-muted-foreground ml-2">
								（タイトルにこれらの単語が含まれていると自動的にこのカテゴリに分類されます）
							</span>
						</Label>
						{/* キーワード追加フォーム */}
						<div className="flex">
							<Input
								id={`keyword-input-${activeCategory}`}
								type="text"
								value={newKeyword}
								onChange={(e) => setNewKeyword(e.target.value)}
								placeholder="新しいキーワードを入力"
								className="flex-grow p-2 border border-border bg-input text-foreground rounded-l focus:ring-2 focus:ring-ring"
								onKeyDown={(e) => {
									if (e.key === "Enter") {
										e.preventDefault();
										handleAddKeyword();
									}
								}}
							/>
							<Button
								type="button"
								onClick={handleAddKeyword}
								disabled={!newKeyword.trim()}
								variant="secondary"
								className={`rounded-l-none flex-shrink-0 cursor-pointer ${
									!newKeyword.trim()
										? "bg-secondary/50 text-muted-foreground cursor-not-allowed"
										: "bg-secondary text-secondary-foreground hover:bg-secondary/80"
								}`}
								aria-label="キーワードを追加"
							>
								<Plus size={18} />
							</Button>
						</div>
					</div>

					{/* キーワード表示を改善 */}
					<div className="flex flex-wrap gap-2 mt-2">
						{keywords.length === 0 ? (
							<p className="text-muted-foreground text-sm">
								キーワードがありません
							</p>
						) : (
							keywords.map((keyword) => (
								<div
									key={keyword}
									className="bg-muted text-foreground px-2 py-1 rounded text-sm flex items-center max-w-full"
									title={keyword}
								>
									<span className="truncate max-w-[150px]">{keyword}</span>
									<Button
										type="button"
										onClick={() => handleRemoveKeyword(keyword)}
										variant="ghost"
										size="sm"
										className="ml-1 p-0 text-muted-foreground hover:text-foreground hover:bg-transparent flex-shrink-0 cursor-pointer"
										aria-label={`キーワード ${keyword} を削除`}
									>
										<X size={14} />
									</Button>
								</div>
							))
						)}
					</div>
				</div>
			)}
		</div>
	);
};

const OptionsPage = () => {
	const [settings, setSettings] = useState<UserSettings>(defaultSettings);
	const [isSaved, setIsSaved] = useState(false);
	const [isLoading, setIsLoading] = useState(true);
	const [parentCategories, setParentCategories] = useState<ParentCategory[]>(
		[],
	);
	const [savedTabs, setSavedTabs] = useState<TabGroup[]>([]);
	const [newCategoryName, setNewCategoryName] = useState("");
	const [categoryError, setCategoryError] = useState<string | null>(null); // エラーメッセージ用の状態変数
	const [editingCategoryId, setEditingCategoryId] = useState<string | null>(
		null,
	);
	const [editingCategoryName, setEditingCategoryName] = useState("");
	const [activeTabId, setActiveTabId] = useState<string | null>(null);
	const editInputRef = useRef<HTMLInputElement>(null);

	// テーマ関連のステート
	const { theme, setTheme } = useTheme();

	useEffect(() => {
		const loadData = async () => {
			try {
				const userSettings = await getUserSettings();
				setSettings(userSettings);

				const categories = await getParentCategories();
				setParentCategories(categories);

				const { savedTabs = [] } = await chrome.storage.local.get("savedTabs");
				setSavedTabs(savedTabs);
			} catch (error) {
				console.error("設定の読み込みエラー:", error);
			} finally {
				setIsLoading(false);
			}
		};

		loadData();

		// ストレージが変更されたときに再読み込み
		chrome.storage.onChanged.addListener((changes) => {
			if (changes.userSettings) {
				setSettings((prev) => ({ ...prev, ...changes.userSettings.newValue }));
			}
			if (changes.parentCategories) {
				setParentCategories(changes.parentCategories.newValue || []);
			}
			if (changes.savedTabs) {
				setSavedTabs(changes.savedTabs.newValue || []);
			}
		});
	}, []);

	const handleSaveSettings = async () => {
		try {
			// 保存する前に空の行を除外
			const cleanSettings = {
				...settings,
				excludePatterns: settings.excludePatterns.filter((p) => p.trim()),
			};
			await saveUserSettings(cleanSettings);
			setIsSaved(true);
			setTimeout(() => setIsSaved(false), 2000);
		} catch (error) {
			console.error("設定の保存エラー:", error);
		}
	};

	// Checkbox用にハンドラを修正 - 非同期関数に変更
	const handleToggleRemoveAfterOpen = async (checked: boolean) => {
		try {
			// 新しい設定を作成
			const newSettings = {
				...settings,
				removeTabAfterOpen: checked,
			};

			// 状態を更新
			setSettings(newSettings);

			// 空の行を除外して保存
			const cleanSettings = {
				...newSettings,
				excludePatterns: newSettings.excludePatterns.filter((p) => p.trim()),
			};

			// 直接保存
			await saveUserSettings(cleanSettings);
			setIsSaved(true);
			setTimeout(() => setIsSaved(false), 2000);
		} catch (error) {
			console.error("設定の保存エラー:", error);
		}
	};

	// Checkbox用にハンドラを修正 - 非同期関数に変更
	const handleToggleEnableCategories = async (checked: boolean) => {
		try {
			// 新しい設定を作成
			const newSettings = {
				...settings,
				enableCategories: checked,
			};

			// 状態を更新
			setSettings(newSettings);

			// 空の行を除外して保存
			const cleanSettings = {
				...newSettings,
				excludePatterns: newSettings.excludePatterns.filter((p) => p.trim()),
			};

			// 直接保存
			await saveUserSettings(cleanSettings);
			setIsSaved(true);
			setTimeout(() => setIsSaved(false), 2000);
		} catch (error) {
			console.error("設定の保存エラー:", error);
		}
	};

	const handleExcludePatternsChange = (
		e: React.ChangeEvent<HTMLTextAreaElement>,
	) => {
		// 空の行も含めて全ての行を保持
		const patterns = e.target.value.split("\n");
		setSettings((prev) => ({
			...prev,
			excludePatterns: patterns,
		}));
	};

	// テキストエリアからフォーカスが外れたときに保存
	const handleExcludePatternsBlur = () => {
		handleSaveSettings();
	};

	// 新しいカテゴリを追加
	const handleAddCategory = async () => {
		if (newCategoryName.trim()) {
			// 重複をチェック
			const isDuplicate = parentCategories.some(
				(cat) =>
					cat.name.toLowerCase() === newCategoryName.trim().toLowerCase(),
			);

			if (isDuplicate) {
				setCategoryError("同じ名前のカテゴリがすでに存在します。");
				setTimeout(() => setCategoryError(null), 3000); // 3秒後にエラーメッセージを消す
				return;
			}

			try {
				await createParentCategory(newCategoryName.trim());
				setNewCategoryName("");
				setCategoryError(null);
			} catch (error) {
				console.error("カテゴリ追加エラー:", error);
				setCategoryError("カテゴリの追加に失敗しました。");
				setTimeout(() => setCategoryError(null), 3000);
			}
		}
	};

	// Enterキーを押したときのハンドラ
	const handleKeyDown = (
		e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
	) => {
		// テキストエリアの場合は元の処理を維持
		if (e.currentTarget.tagName.toLowerCase() === "textarea") {
			if (e.key === "Enter") {
				e.stopPropagation();
			}
		}
		// カテゴリ入力の場合
		else if (e.key === "Enter") {
			e.preventDefault();
			handleAddCategory();
		}
	};

	// カテゴリ名の編集を開始
	const startEditingCategory = (category: ParentCategory) => {
		setEditingCategoryId(category.id);
		setEditingCategoryName(category.name);

		// 編集モードに入った直後に実行される
		setTimeout(() => {
			editInputRef.current?.focus();
		}, 0);
	};

	// カテゴリ名の編集を保存
	const saveEditingCategory = async () => {
		if (editingCategoryId && editingCategoryName.trim()) {
			const updatedCategories = parentCategories.map((cat) =>
				cat.id === editingCategoryId
					? { ...cat, name: editingCategoryName.trim() }
					: cat,
			);

			try {
				await saveParentCategories(updatedCategories);
				setEditingCategoryId(null);
				setEditingCategoryName("");

				// 保存成功通知
				setIsSaved(true);
				setTimeout(() => setIsSaved(false), 2000);
			} catch (error) {
				console.error("カテゴリ編集エラー:", error);
				alert("カテゴリの保存に失敗しました");
			}
		} else {
			// 空の場合は編集をキャンセル
			setEditingCategoryId(null);
		}
	};

	// 直接カテゴリを削除するための単純化メソッド
	const deleteCategory = async (categoryId: string) => {
		try {
			console.log(`カテゴリ削除実行: ${categoryId}`);

			// 更新前のカテゴリ数をログ
			console.log(`削除前のカテゴリ数: ${parentCategories.length}`);

			// フィルタリングで指定IDのカテゴリを除外
			const filteredCategories = parentCategories.filter(
				(cat) => cat.id !== categoryId,
			);

			console.log(`削除後のカテゴリ数: ${filteredCategories.length}`);
			console.log("削除するカテゴリID:", categoryId);
			console.log("フィルタリング後のカテゴリ:", filteredCategories);

			// ストレージに保存
			await chrome.storage.local.set({ parentCategories: filteredCategories });

			// 関連するタブも更新
			const updatedTabs = savedTabs.map((tab) =>
				tab.parentCategoryId === categoryId
					? { ...tab, parentCategoryId: undefined }
					: tab,
			);
			await chrome.storage.local.set({ savedTabs: updatedTabs });

			// ローカル状態を更新
			setParentCategories(filteredCategories);
			setSavedTabs(updatedTabs);

			// 保存成功通知
			setIsSaved(true);
			setTimeout(() => setIsSaved(false), 2000);

			return true;
		} catch (error) {
			console.error("カテゴリ削除エラー:", error);
			return false;
		}
	};

	// カテゴリを削除
	const handleDeleteCategory = async (
		categoryId: string,
		skipConfirmation = false,
	) => {
		console.log(`親カテゴリ削除開始: ID=${categoryId}`);

		try {
			// イベント伝播を防止するため、即時関数を使用
			const proceedWithDeletion =
				skipConfirmation ||
				window.confirm("このカテゴリを削除してもよろしいですか？");
			console.log("確認ダイアログの結果:", proceedWithDeletion);

			if (proceedWithDeletion) {
				// 削除前に現在のカテゴリをログ
				console.log("削除前のカテゴリリスト:", parentCategories);

				// 指定されたIDを持つカテゴリ以外をフィルタリング
				const updatedCategories = parentCategories.filter(
					(cat) => cat.id !== categoryId,
				);
				console.log("削除後のカテゴリリスト:", updatedCategories);

				// 更新したカテゴリリストを保存
				await saveParentCategories(updatedCategories);
				console.log("カテゴリリストの保存完了");

				// 関連するドメインの親カテゴリIDも削除
				const updatedTabs = savedTabs.map((tab) =>
					tab.parentCategoryId === categoryId
						? { ...tab, parentCategoryId: undefined }
						: tab,
				);
				await chrome.storage.local.set({ savedTabs: updatedTabs });
				console.log("関連ドメインの親カテゴリ参照を削除しました");

				// 状態を直接更新して即時反映
				setParentCategories(updatedCategories);
				setSavedTabs(updatedTabs);

				// 削除成功通知
				setIsSaved(true);
				setTimeout(() => setIsSaved(false), 2000);
			} else {
				console.log("カテゴリ削除がキャンセルされました");
			}
		} catch (error) {
			console.error("カテゴリ削除エラー:", error);
			alert("カテゴリの削除中にエラーが発生しました。");
		}
	};

	// ドメインをカテゴリに割り当て関数を改善
	const assignDomainToCategory = async (
		domainId: string,
		categoryId: string | "none",
	) => {
		console.log(`ドメイン割り当て: ID=${domainId}, カテゴリ=${categoryId}`);

		try {
			// 即時のUI更新のための処理
			// 1. UIの状態を先に更新して即時反映
			const uiUpdatedCategories = parentCategories.map((category) => ({
				...category,
				domains: category.domains.filter((id) => id !== domainId),
			}));

			if (categoryId !== "none") {
				const categoryIndex = uiUpdatedCategories.findIndex(
					(cat) => cat.id === categoryId,
				);
				if (categoryIndex !== -1) {
					uiUpdatedCategories[categoryIndex] = {
						...uiUpdatedCategories[categoryIndex],
						domains: [...uiUpdatedCategories[categoryIndex].domains, domainId],
					};
				}
			}

			// UIの表示を即時更新
			setParentCategories(uiUpdatedCategories);

			// Tab.parentCategoryIdも即時更新
			const uiUpdatedTabs = savedTabs.map((tab) =>
				tab.id === domainId
					? {
							...tab,
							parentCategoryId: categoryId !== "none" ? categoryId : undefined,
						}
					: tab,
			);
			setSavedTabs(uiUpdatedTabs);

			// 2. バックグラウンドでストレージ保存を実行
			// セレクトボックスのクローズを待つためにわずかな遅延を入れる
			setTimeout(async () => {
				try {
					// ストレージへの保存
					await saveParentCategories(uiUpdatedCategories);
					await chrome.storage.local.set({ savedTabs: uiUpdatedTabs });
					console.log(
						`ドメイン ${domainId} のカテゴリを ${categoryId} に変更完了`,
					);
				} catch (storageError) {
					console.error("ストレージ保存エラー:", storageError);
					alert("変更の保存中にエラーが発生しました。");
				}
			}, 50); // 50ミリ秒の最小限の遅延
		} catch (error) {
			console.error("ドメイン割り当てエラー:", error);
			alert("ドメインの割り当てに失敗しました。");
		}
	};

	// 単純なカテゴリ削除関数 - 確認ダイアログなし
	const forceDeleteCategory = async (categoryId: string) => {
		try {
			console.log("強制削除を実行:", categoryId);

			// chrome.storage.localから直接取得
			const { parentCategories: storedCategories = [] } =
				await chrome.storage.local.get("parentCategories");

			// カテゴリを削除
			const newCategories = storedCategories.filter(
				(cat: ParentCategory) => cat.id !== categoryId,
			);

			console.log("削除前カテゴリ数:", storedCategories.length);
			console.log("削除後カテゴリ数:", newCategories.length);

			// ストレージに直接保存
			await chrome.storage.local.set({ parentCategories: newCategories });

			// タブの参照も更新
			const { savedTabs: storedTabs = [] } =
				await chrome.storage.local.get("savedTabs");
			const newTabs = storedTabs.map((tab: TabGroup) =>
				tab.parentCategoryId === categoryId
					? { ...tab, parentCategoryId: undefined }
					: tab,
			);

			await chrome.storage.local.set({ savedTabs: newTabs });

			// React状態を更新
			setParentCategories(newCategories);
			setSavedTabs(newTabs);

			// 成功メッセージ
			setIsSaved(true);
			setTimeout(() => setIsSaved(false), 2000);

			return true;
		} catch (error) {
			console.error("強制削除エラー:", error);
			return false;
		}
	};

	if (isLoading) {
		return (
			<div className="flex items-center justify-center min-h-[300px]">
				<div className="text-xl text-foreground">読み込み中...</div>
			</div>
		);
	}

	return (
		<div className="mx-auto pt-10 bg-background min-h-screen">
			<header className="flex justify-between items-center mb-8">
				<h1 className="text-3xl font-bold text-foreground">オプション</h1>

				{/* テーマ切り替えボタン */}

				<ModeToggle />
			</header>

			<div className="bg-card rounded-lg shadow-md p-6 mb-8 border border-border">
				<h2 className="text-xl font-semibold text-foreground mb-4">
					タブの挙動設定
				</h2>

				<div className="mb-4 flex items-center space-x-2">
					<Checkbox
						id="remove-after-open"
						checked={settings.removeTabAfterOpen}
						onCheckedChange={handleToggleRemoveAfterOpen}
						className="cursor-pointer"
					/>
					<Label
						htmlFor="remove-after-open"
						className="text-foreground cursor-pointer"
					>
						保存したタブを開いた後、リストから自動的に削除する
					</Label>
				</div>
				<p className="text-sm text-muted-foreground mt-1 ml-7">
					オンにすると、保存したタブを開いた後、そのタブは保存リストから自動的に削除されます。
					オフにすると、保存したタブを開いても、リストからは削除されません。
				</p>

				<div className="mb-4 flex items-center space-x-2 mt-4">
					<Checkbox
						id="enable-categories"
						checked={settings.enableCategories}
						onCheckedChange={handleToggleEnableCategories}
						className="cursor-pointer"
					/>
					<Label
						htmlFor="enable-categories"
						className="text-foreground cursor-pointer"
					>
						カテゴリ機能を有効にする
					</Label>
				</div>
				<p className="text-sm text-muted-foreground mt-1 ml-7">
					オンにすると、ドメインを親カテゴリでグループ化し、URLを子カテゴリで分類できます。
				</p>
			</div>

			<div className="bg-card rounded-lg shadow-md p-6 mb-8 border border-border">
				<h2 className="text-xl font-semibold text-foreground mb-4">除外設定</h2>
				<div className="mb-4">
					<Label
						htmlFor="excludePatterns"
						className="block text-foreground mb-2"
					>
						保存・閉じない URL パターン（1行に1つ）
					</Label>
					<Textarea
						id="excludePatterns"
						value={settings.excludePatterns.join("\n")}
						onChange={handleExcludePatternsChange}
						onBlur={handleExcludePatternsBlur}
						onKeyDown={handleKeyDown}
						className="w-full h-32 p-2 border border-input bg-background text-foreground rounded focus:ring-2 focus:ring-ring"
						placeholder="例：&#10;chrome-extension://&#10;chrome://"
					/>
					<p className="text-sm text-muted-foreground mt-1">
						これらのパターンに一致するURLは保存されず、タブも閉じられません。
					</p>
				</div>
			</div>

			{settings.enableCategories && (
				<div className="bg-card rounded-lg shadow-md p-6 mb-8 border border-border">
					<h2 className="text-xl font-semibold text-foreground mb-4">
						カテゴリ管理
					</h2>

					{/* 親カテゴリ管理 - レスポンシブ対応改善 */}
					<div className="mb-6">
						<h3 className="text-lg font-medium text-foreground mb-3">
							親カテゴリ
						</h3>
						<div className="mb-4">
							<Input
								type="text"
								value={newCategoryName}
								onChange={(e) => setNewCategoryName(e.target.value)}
								onBlur={handleAddCategory}
								onKeyDown={handleKeyDown}
								placeholder="新しいカテゴリ名"
								className="w-full p-2 border border-input bg-background text-foreground rounded focus:ring-2 focus:ring-ring"
							/>
						</div>
						{categoryError && (
							<p className="text-foreground text-sm mb-3 bg-muted p-2 rounded">
								{categoryError}
							</p>
						)}

						{parentCategories.length === 0 ? (
							<p className="text-muted-foreground italic">
								カテゴリがまだありません。
							</p>
						) : (
							<ul className="space-y-2 mb-4">
								{[...parentCategories]
									.sort((a, b) => b.domains.length - a.domains.length)
									.map((category) => (
										<li
											key={category.id}
											className="border border-border p-3 rounded-md bg-card flex justify-between items-center"
										>
											{editingCategoryId === category.id ? (
												<div className="flex flex-1">
													<Input
														type="text"
														ref={editInputRef}
														value={editingCategoryName}
														onChange={(e) =>
															setEditingCategoryName(e.target.value)
														}
														onBlur={saveEditingCategory}
														onKeyDown={(e) => {
															if (e.key === "Enter") {
																e.preventDefault();
																saveEditingCategory();
															} else if (e.key === "Escape") {
																setEditingCategoryId(null);
															}
														}}
														className="flex-grow p-1 bg-background text-foreground border border-input rounded w-full"
													/>
												</div>
											) : (
												<Button
													type="button"
													variant="ghost"
													className="font-medium cursor-pointer hover:text-foreground hover:underline text-left bg-transparent border-none p-0 text-foreground flex items-center space-x-2 max-w-full"
													onClick={() => startEditingCategory(category)}
													onKeyDown={(e) => {
														if (e.key === "Enter" || e.key === "Space") {
															e.preventDefault();
															startEditingCategory(category);
														}
													}}
													title={`${category.name} (${category.domains.length}ドメイン)`}
													aria-label={`${category.name}を編集 (${category.domains.length}ドメイン)`}
												>
													<span className="truncate w-[180px]">
														{category.name}
													</span>
													<span className="flex-shrink-0 text-muted-foreground">
														({category.domains.length})
													</span>
												</Button>
											)}

											<div className="flex-shrink-0">
												{editingCategoryId !== category.id && (
													<Tooltip>
														<TooltipTrigger asChild>
															<Button
																type="button"
																onClick={() => startEditingCategory(category)}
																variant="ghost"
																size="sm"
																className="text-foreground hover:text-foreground cursor-pointer"
															>
																<Edit size={16} />
															</Button>
														</TooltipTrigger>
														<TooltipContent>カテゴリ名を編集</TooltipContent>
													</Tooltip>
												)}
												{/* 削除ボタン */}
												<Tooltip>
													<TooltipTrigger asChild>
														<Button
															type="button"
															onClick={(e) => {
																e.preventDefault();
																e.stopPropagation();
																console.log("削除ボタンがクリックされました");
																forceDeleteCategory(category.id);
															}}
															variant="ghost"
															size="sm"
															className="cursor-pointer"
														>
															<Trash size={16} />
														</Button>
													</TooltipTrigger>
													<TooltipContent>カテゴリを削除</TooltipContent>
												</Tooltip>
											</div>
										</li>
									))}
							</ul>
						)}
					</div>

					{/* ドメイン割り当て - テーブルレイアウト改善 */}
					{savedTabs.length > 0 && (
						<div>
							<h3 className="text-lg font-medium text-foreground mb-3">
								ドメイン管理
							</h3>
							<div className="overflow-auto max-h-96">
								<table className="w-full text-left mb-4 table-fixed">
									<thead className="bg-muted">
										<tr>
											<th className="p-2 text-foreground w-2/5">ドメイン</th>
											<th className="p-2 text-foreground w-2/5">カテゴリ</th>
											<th className="p-2 text-foreground w-1/5">アクション</th>
										</tr>
									</thead>
									<tbody>
										{savedTabs.map((tab) => {
											const currentCategory = parentCategories.find((cat) =>
												cat.domains.includes(tab.id),
											);

											return (
												<tr key={tab.id} className="border-b border-border">
													<td
														className="p-2 truncate text-foreground"
														title={tab.domain}
													>
														{tab.domain}
													</td>
													<td className="p-2">
														<Select
															value={currentCategory?.id || "none"}
															onValueChange={(value) => {
																console.log(`選択されたカテゴリID: ${value}`);
																assignDomainToCategory(tab.id, value);
															}}
														>
															<SelectTrigger className="w-full bg-background text-foreground border-input truncate cursor-pointer">
																<SelectValue placeholder="カテゴリを選択" />
															</SelectTrigger>
															<SelectContent
																onPointerDownOutside={(e) => {
																	e.preventDefault();
																}}
																className="max-h-[300px] overflow-y-auto"
															>
																<SelectItem
																	value="none"
																	onPointerDown={(e) => e.stopPropagation()}
																	className="cursor-pointer"
																>
																	未分類
																</SelectItem>
																{parentCategories.map((category) => (
																	<SelectItem
																		key={category.id}
																		value={category.id}
																		onPointerDown={(e) => e.stopPropagation()}
																		className="truncate cursor-pointer"
																		title={category.name}
																	>
																		{category.name}
																	</SelectItem>
																))}
															</SelectContent>
														</Select>
													</td>
													<td className="p-2">
														<Button
															type="button"
															onClick={() =>
																setActiveTabId(
																	activeTabId === tab.id ? null : tab.id,
																)
															}
															variant="outline"
															size="sm"
															className="text-sm bg-muted hover:bg-muted/70 text-foreground w-full cursor-pointer"
														>
															{activeTabId === tab.id
																? "閉じる"
																: "キーワード設定"}
														</Button>
													</td>
												</tr>
											);
										})}
									</tbody>
								</table>

								{activeTabId && (
									<div className="bg-muted/50 p-4 rounded mb-4 border border-border">
										<h4 className="text-md font-semibold mb-2 text-foreground">
											{savedTabs.find((tab) => tab.id === activeTabId)?.domain}{" "}
											の詳細設定
										</h4>
										<SubCategoryKeywordManager
											tabGroup={
												savedTabs.find((tab) => tab.id === activeTabId) || {
													id: activeTabId,
													domain: "",
													urls: [],
													subCategories: [],
													categoryKeywords: [],
												}
											}
										/>
									</div>
								)}
							</div>
						</div>
					)}
				</div>
			)}

			{isSaved && (
				<div className="text-center mb-4">
					<span className="text-foreground bg-muted px-3 py-1 rounded font-medium">
						設定が保存されました！
					</span>
				</div>
			)}
		</div>
	);
};

// Reactコンポーネントをレンダリング
document.addEventListener("DOMContentLoaded", () => {
	const appContainer = document.getElementById("options-app");
	if (!appContainer)
		throw new Error("Failed to find the options app container");

	const root = createRoot(appContainer);
	root.render(
		<ThemeProvider defaultTheme="system" storageKey="tab-manager-theme">
			<OptionsPage />
		</ThemeProvider>,
	);
});
