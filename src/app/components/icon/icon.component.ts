import { Component, Input, OnInit, OnChanges } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

// Import all the icons we need statically (using regular style)
import addIcon from '@fluentui/svg-icons/icons/add_20_regular.svg';
import editIcon from '@fluentui/svg-icons/icons/edit_20_regular.svg';
import deleteIcon from '@fluentui/svg-icons/icons/delete_20_regular.svg';
import copyIcon from '@fluentui/svg-icons/icons/copy_20_regular.svg';
import refreshIcon from '@fluentui/svg-icons/icons/arrow_sync_20_regular.svg';
import chevronUpIcon from '@fluentui/svg-icons/icons/chevron_up_20_regular.svg';
import chevronDownIcon from '@fluentui/svg-icons/icons/chevron_down_20_regular.svg';
import chevronLeftIcon from '@fluentui/svg-icons/icons/chevron_left_20_regular.svg';
import chevronRightIcon from '@fluentui/svg-icons/icons/chevron_right_20_regular.svg';
import chevronDoubleLeftIcon from '@fluentui/svg-icons/icons/chevron_double_left_20_regular.svg';
import chevronDoubleRightIcon from '@fluentui/svg-icons/icons/chevron_double_right_20_regular.svg';
import arrowRightIcon from '@fluentui/svg-icons/icons/arrow_right_20_regular.svg';
import homeIcon from '@fluentui/svg-icons/icons/home_20_regular.svg';
import warningIcon from '@fluentui/svg-icons/icons/warning_20_regular.svg';
import checkmarkCircleIcon from '@fluentui/svg-icons/icons/checkmark_circle_20_regular.svg';
import errorCircleIcon from '@fluentui/svg-icons/icons/error_circle_20_regular.svg';
import errorIcon from '@fluentui/svg-icons/icons/error_circle_20_regular.svg';
import clockIcon from '@fluentui/svg-icons/icons/clock_20_regular.svg';
import infoIcon from '@fluentui/svg-icons/icons/info_20_regular.svg';
import arrowSyncCircleIcon from '@fluentui/svg-icons/icons/arrow_sync_20_regular.svg';
import folderIcon from '@fluentui/svg-icons/icons/folder_20_regular.svg';
import folderOpenIcon from '@fluentui/svg-icons/icons/folder_open_20_regular.svg';
import documentIcon from '@fluentui/svg-icons/icons/document_20_regular.svg';
import listIcon from '@fluentui/svg-icons/icons/list_20_regular.svg';
import tableSimpleIcon from '@fluentui/svg-icons/icons/table_20_regular.svg';
import inboxIcon from '@fluentui/svg-icons/icons/mail_inbox_20_regular.svg';
import linkIcon from '@fluentui/svg-icons/icons/link_20_regular.svg';
import openIcon from '@fluentui/svg-icons/icons/open_20_regular.svg';
import arrowDownloadIcon from '@fluentui/svg-icons/icons/arrow_download_20_regular.svg';
import searchIcon from '@fluentui/svg-icons/icons/search_20_regular.svg';
import searchOffIcon from '@fluentui/svg-icons/icons/dismiss_20_regular.svg';
import dismissIcon from '@fluentui/svg-icons/icons/dismiss_20_regular.svg';
import settingsIcon from '@fluentui/svg-icons/icons/settings_20_regular.svg';
import fontDecreaseIcon from '@fluentui/svg-icons/icons/font_decrease_20_regular.svg';
import fontIncreaseIcon from '@fluentui/svg-icons/icons/font_increase_20_regular.svg';
import fontSizeIcon from '@fluentui/svg-icons/icons/text_font_size_20_regular.svg';

// Theme toggle icons
import sunIcon from '@fluentui/svg-icons/icons/weather_sunny_20_regular.svg';
import moonIcon from '@fluentui/svg-icons/icons/weather_moon_20_regular.svg';

// Status icons for config page
import onlineIcon from '@fluentui/svg-icons/icons/checkmark_circle_20_regular.svg';
import offlineIcon from '@fluentui/svg-icons/icons/error_circle_20_regular.svg';
import checkingIcon from '@fluentui/svg-icons/icons/clock_20_regular.svg';

/**
 * Icon component that uses official Fluent UI System Icons from @fluentui/svg-icons
 */
@Component({
  selector: 'fluent-icon',
  template: `<span class="fluent-icon" [innerHTML]="iconSvg" aria-hidden="true"></span>`,
  styles: [`
    .fluent-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
      color: inherit;
    }
    .fluent-icon svg {
      width: 100%;
      height: 100%;
      fill: currentColor !important;
    }
    .fluent-icon svg path {
      fill: inherit !important;
    }
  `]
})
export class IconComponent implements OnInit, OnChanges {
  @Input() name: string = '';
  @Input() filled: boolean = false; // Default to regular style
  @Input() size: number = 20;

  iconSvg: SafeHtml = '';

  private readonly icons: { [key: string]: string } = {
    // Action icons
    'add': addIcon,
    'edit': editIcon,
    'delete': deleteIcon,
    'copy': copyIcon,
    'refresh': refreshIcon,

    // Navigation icons
    'chevron_up': chevronUpIcon,
    'chevron_down': chevronDownIcon,
    'chevron_left': chevronLeftIcon,
    'chevron_right': chevronRightIcon,
    'chevron_double_left': chevronDoubleLeftIcon,
    'chevron_double_right': chevronDoubleRightIcon,
    'arrow_right': arrowRightIcon,
    'home': homeIcon,

    // Status icons
    'warning': warningIcon,
    'checkmark_circle': checkmarkCircleIcon,
    'error_circle': errorCircleIcon,
    'error': errorIcon,
    'clock': clockIcon,
    'info': infoIcon,
    'arrow_sync_circle': arrowSyncCircleIcon,

    // Content icons
    'folder': folderIcon,
    'folder_open': folderOpenIcon,
    'document': documentIcon,
    'list': listIcon,
    'table_simple': tableSimpleIcon,
    'inbox': inboxIcon,
    'link': linkIcon,
    'open': openIcon,
    'arrow_download': arrowDownloadIcon,

    // UI icons
    'search': searchIcon,
    'search_off': searchOffIcon,
    'dismiss': dismissIcon,
    'settings': settingsIcon,

    // Font size icons
    'font_decrease': fontDecreaseIcon,
    'font_increase': fontIncreaseIcon,
    'font_size': fontSizeIcon,

    // Theme toggle icons
    'sun': sunIcon,
    'moon': moonIcon,
    'light_mode': sunIcon,
    'dark_mode': moonIcon,
    'weather_sunny': sunIcon,
    'weather_moon': moonIcon,

    // Config page status icons
    'online': onlineIcon,
    'offline': offlineIcon,
    'checking': checkingIcon
  };

  constructor(private sanitizer: DomSanitizer) {}

  ngOnInit() {
    this.loadIcon();
  }

  ngOnChanges() {
    this.loadIcon();
  }

  private loadIcon() {
    if (!this.name) {
      this.iconSvg = '';
      return;
    }

    const svgContent = this.icons[this.name];
    if (svgContent) {
      // Process the SVG to ensure it adapts to theme colors
      let processedSvg = svgContent;

      // Add fill="currentColor" to the SVG element if it doesn't have a fill attribute
      if (!processedSvg.includes('fill=')) {
        processedSvg = processedSvg.replace('<svg', '<svg fill="currentColor"');
      }

      // Also ensure any path elements without fill attribute inherit currentColor
      processedSvg = processedSvg.replace(/<path(?![^>]*fill=)/g, '<path fill="currentColor"');

      this.iconSvg = this.sanitizer.bypassSecurityTrustHtml(processedSvg);
    } else {
      console.warn(`Icon not found: ${this.name}`, 'Available icons:', Object.keys(this.icons));
      this.iconSvg = '';
    }
  }
}
